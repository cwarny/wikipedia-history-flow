var request = require("request"),
	qs = require("querystring"),
	async = require("async"),
	mongodb = require("mongodb");

var MONGODB_URI = "mongodb://localhost/wikipedia",
	db,
	revisions;

var api_root_url = "http://en.wikipedia.org/w/api.php?",
	export_root_url = "http://en.wikipedia.org/w/index.php?";

var api_root_url = "http://en.wikipedia.org/w/api.php?",
	export_root_url = "http://en.wikipedia.org/w/index.php?";

var title = "Albert_Camus",
	properties = "revisions",
	diffto = "next",
	limit = 100,
	rvprop = "user|userid|ids|timestamp|content|comment|parsedcomment|flags",
	dir = "newer";

var api_url;

mongodb.MongoClient.connect(MONGODB_URI, function(err, database) {
	if (err) throw err;
	db = database;
	revisions = db.collection("revisions");

	async.parallel([
		function(cb) {
			f("20010101000000", "20020101000000", 0, cb)
		},
		function(cb) {
			f("20020101000000", "20030101000000", 0, cb)
		},
		function(cb) {
			f("20030101000000", "20040101000000", 0, cb)
		},
		function(cb) {
			f("20040101000000", "20050101000000", 0, cb)
		},
		function(cb) {
			f("20050101000000", "20060101000000", 0, cb)
		},
		function(cb) {
			f("20060101000000", "20070101000000", 0, cb)
		},
		function(cb) {
			f("20070101000000", "20080101000000", 0, cb)
		},
		function(cb) {
			f("20080101000000", "20090101000000", 0, cb)
		},
		function(cb) {
			f("20090101000000", "20100101000000", 0, cb)
		},
		function(cb) {
			f("20100101000000", "20110101000000", 0, cb)
		},
		function(cb) {
			f("20110101000000", "20120101000000", 0, cb)
		},
		function(cb) {
			f("20120101000000", "20130101000000", 0, cb)
		},
		function(cb) {
			f("20130101000000", "20140101000000", 0, cb)
		}
	],
	function(err, results) {
		console.log("Done");
	});
});

function f(latestTimestamp, maxTimestamp, k, cb) {

	var api_url = api_root_url + qs.stringify({format:"json", action:"query", titles:title, prop:properties, rvdiffto:diffto, rvlimit:limit, rvprop:rvprop, rvdir:dir, rvstart:latestTimestamp, rvend:maxTimestamp });

	request(api_url, function(err, res, body) {

		if (err) throw err;
		var data = JSON.parse(body);
		if (!data.query.pages["983"].hasOwnProperty("revisions")) {
			cb(null, "yo");
		} else {
			var revisions = data.query.pages["983"].revisions;
			var otext;
			var latestRevision = revisions[revisions.length-1];
			if (latestRevision.timestamp == latestTimestamp) console.log("Same timestamp");
			var latestTimestamp = latestRevision.timestamp;

			for (var i=0; i<revisions.length; i++) {

				if (revisions[i].diff.hasOwnProperty("notcached")) {
					latestRevision = revisions[i];
					latestTimestamp = latestRevision.timestamp;
					console.log("Not cached");
					break;
				}

				console.log(revisions[i].timestamp);

				k++;
			}

			latestTimestamp = (parseFloat(latestTimestamp.replace(/[\-T\:Z]/g,"")) + 1).toString();
			if (latestTimestamp < maxTimestamp) f(latestTimestamp, maxTimestamp, k, cb);
			else cb(null, "yo");
		}
	});

}