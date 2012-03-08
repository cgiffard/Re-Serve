## Re-Serve

A really straightforward way to archive and serve entire domains from cache. Relies on node and node-simplecrawler to work (packaged).

Happily churns through gigabytes and gigabytes of data - I've used this for archiving some very large websites.

Please don't abuse it! The archiver prioritises speed of archiving over being nice to webservers, (I'll add a runtime preference for this in future) so make sure you have the blessing of your webmaster. 😖

### Usage

_Please note that this code is still somewhat immature, and usage will be changed as it is cleaned up._

#### Archiving

	./index.js -v domain1.com domain2.com domain3.com domain4.com/initialpath
	
#### Serving From Cache

Detects domain to serve based on `Host` HTTP header:

	./servecache.js
	
Or you can scope what it serves to a specific domain:

	./servecache.js domain1.com
	
#### Repairing the cache

	./repaircache.js
	
	
### Notes

Makes a 'cache' folder in the CWD. This is as close as possible to a complete directory-for-directory clone of a given website.

Still a bit 'developmenty', but it should be extremely easy to debug.

Once I've published node-simplecrawler to npm, I'll remove the submodule from the directory and structure the repo to make it easier to use as a system-wide utility.

### Todo:

* Custom UA support
* NPM
* Tests (I'm one of those bastards that '_forgets_' to do TDD from the start)
* Cleanup