#!/usr/bin/env node

// Serve Website From Cache
//
// This utility enables you to serve a website from the simple-crawler cache.
// Useful for archiving websites for offline use, or debugging.

var fs = require("fs"),
	http = require("http"),
	crypto = require("crypto"),
	SimpleCrawler = require("./node-simplecrawler"),
	Crawler = SimpleCrawler.Crawler,
	Queue = SimpleCrawler.Queue,
	Cache = SimpleCrawler.Cache;
	
// We're using the filesystem cache backend here, just by not providing a default.
var globalCache = new Cache();

// The user can specify a domain to serve, or we'll just look at the VHost.
var domain = process.argv.length > 2 ? process.argv[2] : null;

// We also assume a port of 80.
// In future, logic will be added to extend this.
var port = 80;

// Start our server!
var server = http.createServer(function(request,response) {
	var host = domain ? domain : request.headers['host'];
	
	// Pull port out of hostname if it's been combined.
	if (host.match(/\:\d+$/)) {
		host = host.split(/\:/).shift();
	}
	
	var cacheHitURL = "http://" + host + request.url;
	
	// Report on request...
	console.log("%s | %s",request.method,cacheHitURL);
	
	// Function to handle the returned data from the cache
	function handleCacheResult(cacheData) {
		if (cacheData) {
			console.log("CACHE HIT");
			cacheData.getMetadata(function(error,metadata) {
				// Possibly bad, but we send the data down with the exact same headers we sent when we got it.
				response.writeHead(200,metadata.stateData.headers);
				
				cacheData.getData(function(error,data) {
					if (error) {
						response.end("Failed to read file data.");
					} else {
						if (1 === 2 && metadata.stateData.contentType.match(/^text\//)) {
							// May not be so good for international encodings, but I'm just getting this working for now.
							var rewrittenData = data.toString("utf8");
							
							rewrittenData = rewrittenData.replace(new RegExp("http:\/\/(www\.)?" + domain + "(\/)?","ig"),"/");
							
							response.write(rewrittenData);
							response.end();
						} else {
							response.write(data);
							response.end();
						}
					}
				});
			});
		} else {
			// Hrm. Let's build a filepath based on our knowledge of fs-backend.
			// Perhaps it's just the index entry that's missing.
			var cachePathTest = process.cwd() + "/cache/http/" + host + "/80/", filePath;
			var subPath = request.url.replace(/^\//,"");
			
			if (subPath.match(/\?/)) {
				var subpathParts = subPath.split(/\?/);
				subPath = subpathParts.shift();
				
				var cryptoHash =
					crypto
						.createHash("sha1")
						.update(subpathParts.join("?"))
						.digest("hex");
				
				// Just try HTML for now. We don't know the mimetype, and it'd be a pain to find out.
				subPath += "?" + cryptoHash + ".html";
			}
			
			filePath = cachePathTest + subPath;
			cachePathTest = cachePathTest + subPath + ".cacheData.json";
			
			// Try read in the file...
			fs.readFile(cachePathTest,function(error,data) {
				if (error) {
					if (cacheHitURL.match(/\/$/)) {
						console.log("Folder hit. Redirecting to file...");
						cacheHitURL += ".html";
						
						globalCache.getCacheData({
								"url" : cacheHitURL
							},
							function(cacheData) {
								handleCacheResult(cacheData);
							}
						);
					} else if (cacheHitURL.match(/\/\.html$/i)) {
						console.log("Redirected folder hit. Inflating to index.html...");
						cacheHitURL = cacheHitURL.replace(/\/\.html$/i,"/index.html");
						
						globalCache.getCacheData({
								"url" : cacheHitURL
							},
							function(cacheData) {
								handleCacheResult(cacheData);
							}
						);
						
					} else {
						// Some URLs are kinda horrible. Fix and try again...
						if (cacheHitURL.replace(/^http(s)?\:\/+/,"").match(/\/\/+/)) {
							// Fix up the URL and try again...
							cacheHitURL = cacheHitURL.replace(/\/\/+/g,"/").replace(/^http\:\//,"http://");
						
							globalCache.getCacheData({
									"url" : cacheHitURL
								},
								function(cacheData) {
									handleCacheResult(cacheData);
								}
							);
						} else {
							response.writeHead(404);
							response.write("Failed to locate resource. Has it been cached?");
							response.end();
							console.log("CACHE MISS: %s",cacheHitURL);
						}
					}
				} else {
					// Wow, the file existed but it wasn't in the cache index.
					console.log("FILE FOUND, MISSED CACHE: %s",cacheHitURL);
					
					var metadata = JSON.parse(data);
					
					// Send file with headers loaded off disk.
					response.writeHead(200,metadata.stateData.headers);
					
					fs.readFile(filePath,function(error,data) {
						if (error) {
							response.end("Failed to read file data.");
						} else {
							if (metadata.stateData.contentType.match(/^text\//)) {
							
								// May not be so good for international encodings, but I'm just getting this working for now.
								var rewrittenData = data.toString("utf8");
								
								// Rewrite links with the domain in them so we stay on this webserver
								rewrittenData = rewrittenData.replace(new RegExp("http:\/\/(www\.)?" + domain + "(\/)?","ig"),"/");
							
								response.write(rewrittenData);
								response.end();
							} else {
								response.write(data);
								response.end();
							}
							
							// OK, we read the data correctly, as well as the metadata. We have everything
							// we need to restore the cache item to its proper place.
							// globalCache.setCacheData(metadata,data,function() {
							// 								console.log("Called back from cache repair. Check again!");
							// 								globalCache.saveCache();
							// 							});
						}
					});
				}
			});	
		}
	}
	
	// get the actual data...
	globalCache.getCacheData({
			"url" : cacheHitURL
		},
		function(cacheData) {
			handleCacheResult(cacheData);
		}
	);
});

server.listen(3000);