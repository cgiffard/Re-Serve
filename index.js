#!/usr/bin/env node

var SimpleCrawler = require("./node-simplecrawler"),
	Crawler = SimpleCrawler.Crawler,
	Queue = SimpleCrawler.Queue,
	Cache = SimpleCrawler.Cache,
	globalCache;
	crawlers = [];

var arguments = process.argv.slice(2),
	switches = arguments.filter(function(arg) {
		return !!arg.match(/^\-[a-z0-9]/i);
	});

var domains = arguments.filter(function(arg) {
		return !arg.match(/^\-[a-z0-9]/i);
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
	
	var proxyMatch;
	var proxyData = switches.filter(function(arg) { return arg.match(/^\-P/);});
	var usingProxy = false,
		proxyHostname = null
		proxyPort = null;
	
	if (proxyData.length) {
		proxyData = proxyData.shift();
		
		if ((proxyMatch = proxyData.match(/-P([a-z0-9\.\-]+)\:(\d+)/i))) {
			usingProxy = true;
			proxyHostname = proxyMatch[1];
			proxyPort = parseInt(proxyMatch[2],10);
		} else {
			console.error("Invalid proxy definition (%s). Proxy switch must be of the format: -Phostname:port",proxyData);
		}
	}
	
	var allowedDomains = [];
	var allowedDomainSwitch = switches.filter(function(arg) { return arg.match(/^\-A/);});
	allowedDomainSwitch.forEach(function(domainSwitch) {
		var allowedDomain = null;
		if ((allowedDomain = domainSwitch.match(/-A([a-z0-9\.\-]+)/i))) {
			allowedDomains.push(allowedDomain[1]);
			console.log("Specially allowing domain %s",allowedDomain[1]);
		}
	});
	
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
		
		// Port...
		var portMatch, port = 80;
		if ((portMatch = domain.match(/\:(\d+)$/))) {
			port = portMatch[1];
			domain = domain.replace(/\:\d+$/i,"");
		}

		console.log("Crawling domain %s...",domain);
		if (path) console.log("Scoped to path %s",path);
		
		// Generate the crawler.
		var crawler = new Crawler(domain,path,port);
		crawler.cache = globalCache;
		
		// Set up proxy if requested
		if (usingProxy) {
			crawler.useProxy = true;
			crawler.proxyHostname = proxyHostname;
			crawler.proxyPort = proxyPort;
			
			console.log("Crawling domain %s through proxy: %s:%d",domain,proxyHostname,proxyPort);
		}
		
		// Add allowed domains to crawler whitelist
		crawler.domainWhitelist = allowedDomains;
		
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
			var domainsDiscovered = [];
			crawler.on("queueadd",function(queueItem) {
				if (!domainsDiscovered.reduce(function(prev,cur) {
						return prev || queueItem.domain === cur;
					},false)) {
					
					domainsDiscovered.push(queueItem.domain);
					console.log("Discovered a new domain: %s -> Linked from: %s",queueItem.domain,queueItem.referrer);
					console.log("Is domain valid?",crawler.isDomainValid(queueItem.domain));
				}
			});
			
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