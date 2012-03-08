#!/usr/bin/env node

// Repair Cache Index
//
// This utility repairs your cache index based on the contents
// of your filesystem cache. Only useful for the filesystem backend.

var fs = require("fs"),
	http = require("http"),
	crypto = require("crypto"),
	SimpleCrawler = require("./node-simplecrawler"),
	Crawler = SimpleCrawler.Crawler,
	Queue = SimpleCrawler.Queue,
	Cache = SimpleCrawler.Cache;
	
// We're using the filesystem cache backend here, just by not providing a default.
var globalCache = new Cache();

// Set up a cache folder
var cacheFolder = process.cwd() + "/cache";

// Maxiumum number of files open simultaneously
var fileOpenLimit = 5;

// Function for scanning folders recursively
function scanFolder(path) {
	fs.readdir(path,function(error,contents) {
		if (error) {
			console.error("Unable to scan directory: %s",path);
			return;
		}
		
		contents.forEach(function(file) {
			var currentResource = path + "/" + file
			
			fs.stat(currentResource, function(error,stat) {
				if (error) {
					console.error("Unable to stat file: %s",currentResource);
					return;
				}
				
				if (stat && stat.isDirectory()) {
					scanFolder(currentResource);
				} else {
					// It's some other kind of file.
					if (file.match(/\.cacheData.json$/)) {
						// and it's a cachedData file!
						readAndRepair(currentResource);
					}
				}
			});
		});
	});
};

// Function for reading the .cacheData.json files into the cache itself
function readAndRepair(resourceFile) {
	batchRead(resourceFile,function(error,data) {
		if (error) {
			console.error("Error reading %s",resourceFile);
			throw error;
			return;
		}
		
		try {
			var cacheFragmentData = JSON.parse(data);
		
			globalCache.getCacheData({
					"url" : cacheFragmentData.url
				},
				function(cacheData) {
					if (!cacheData) {
						// looks like the item hasn't been saved yet...
						// So we'll save it back into the cache.
						var dataFile = resourceFile.replace(/\.cacheData\.json$/,"");
						
						fs.readFile(dataFile,function(error,data) {
							if (error) {
								console.error("Failed to read data file for %s",dataFile);
							}
							
							globalCache.setCacheData(cacheFragmentData,data,function() {
								console.log("Repaired cache item for %s",resourceFile);
							});
						});
					}
				}
			);
			
		} catch(error) {
			console.log("ERROR: Encountered error repairing %s",resourceFile);
			console.log(error);
		}
	});
}

var readQueue = [];
var openFileCount = 0;
function batchRead(file,callback) {
	readQueue.push({
		initialised: false,
		complete: false,
		file: file,
		callback: callback
	});
	
	processQueue();
}

function processQueue() {
	if (openFileCount < fileOpenLimit) {
		// We've got an opening (or a few)
		var filesToSpool = fileOpenLimit - openFileCount;
		
		for (var spoolCount = 0; spoolCount < filesToSpool; spoolCount++) {
			var nextFileIndex =
				readQueue.reduce(function(prev,current,index) {
					return prev || (current && !current.initialised && !current.complete ? index : null);
				},null);
			
			if (readQueue[nextFileIndex]) {
				var queueItem = readQueue[nextFileIndex];
				var fileName = readQueue[nextFileIndex].file;
				var callback = readQueue[nextFileIndex].callback;
				
				queueItem.initialised = true;
				
				//console.log("spooling read for %s...",fileName);
				openFileCount ++;
				fs.readFile(fileName,function(error,data) {
					openFileCount --;
					if (error) {
						console.error(error);
					}
					
					// Clear from the queue..
					queueItem.complete = true;
					
					// Run queue advancement...
					processQueue();
				
					// Fire callback
					callback(error,data);
				});
			}
		}
	}
}

//// Kick this puppy off.
console.log("Repairing cache in folder: %s",cacheFolder);
scanFolder(cacheFolder);

// And handle exiting
process.on("SIGINT",function() {
	console.log("Caught interrupt. Dying softly...");
	process.exit(0);
});

process.on("exit",function() {
	console.log("Saving cache...");
	globalCache.saveCache();
});