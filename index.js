#!/usr/bin/env node

var SimpleCrawler = require("./node-simplecrawler"),
	Crawler = SimpleCrawler.Crawler,
	Queue = SimpleCrawler.Queue,
	Cache = SimpleCrawler.Cache,
	globalCache;
	crawlers = [];

var arguments = process.argv.slice(2),
	switches = arguments.filter(function(arg) {
		return !!arg.match(/^\-[a-z0-9]$/i);
	});

var domains = arguments.filter(function(arg) {
		return !arg.match(/^\-[a-z0-9]$/i);
	});

var verboseMode = false;

if (!domains.length) {
	console.error("You must supply at least one domain to crawl.");
	process.exit(1);
	
} else {
	if (switches.filter(function(arg) { return arg === "-v"; }).length) {
		console.log("Using verbose mode.");
		verboseMode = true;
	}
	
	// Single cache object for all domains/crawlers
	globalCache = new Cache();
	
	// Keep track of crawlers which have completed.
	var completedCrawlers = 0;
	
	domains.forEach(function(domain) {
		var path = null;
		
		// Stop users getting too clever
		domain = domain.replace(/^http(s)?\:\/+/i,"");
		
		// If there's a path we're scoped to - find that out now.
		if (domain.match(/\//)) {
			path = "/" + domain.split(/\//).slice(1).join("/");
			domain = domain.split(/\//).shift();
		}

		console.log("Crawling domain %s...",domain);
		if (path) console.log("Scoped to path %s",path);
		
		// Generate the crawler.
		var crawler = new Crawler(domain,path);
		crawler.cache = globalCache;
		
		// Respect user's wishes about whether they want www preserved or not...
		if (!domain.match(/^www\./i)) {
			crawler.stripWWWDomain = true;
		} else {
			// And if they've specified www, get ready to crawl it!
			crawler.ignoreWWWDomain = false;
			crawler.scanSubdomains = true;
		}
		
		crawler.queue.defrost("./cache/cached-queue-" + crawler.domain + ".json");
		crawler.start();
		crawlers.push(crawler);
		
		crawler.on("end",function() {
			console.log("Completed crawl of %s.",crawler.domain);
			completedCrawlers ++;
			
			if (completedCrawlers === crawlers.length) {
				console.log("Finished crawling.");
				process.exit(0);
			}
		});
		
		if (verboseMode) {
			crawler.on("fetchstart",function(queueItem) {
				console.log(
					"Crawler %s: %d/%d %d%	- Fetching %s",
					crawler.domain,
					crawler.queue.complete(),
					crawler.queue.length,
					Math.round((crawler.queue.complete()/crawler.queue.length)*1000)/10,
					queueItem.url
				);
			});
		}
	});
}


process.on("SIGINT",function() {
	console.log("Caught interrupt. Dying softly...");
	
	// Save cache
	console.log("Saving cache...");
	globalCache.saveCache();
	
	// Save all the crawlers
	crawlers.forEach(function(crawler) {
		console.log("Saving queue for %s...",crawler.domain);
		crawler.queue.freeze("./cache/cached-queue-" + crawler.domain + ".json");
	});
	
	process.exit(0);
});