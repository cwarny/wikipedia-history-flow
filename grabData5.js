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

var format = "json",
	title = "Albert_Camus",
	properties = "revisions",
	diffto = "next",
	limit = 5,
	rvprop = "user|userid|ids|timestamp|content|comment|parsedcomment|flags",
	dir = "newer";

var latestTimestamp;

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
		}
	],
	function(err, results) {
		console.log("Done");
	});
});

function f(latestTimestamp, maxTimestamp, k, cb) {

	var api_url = api_root_url + qs.stringify({format:format, action:"query", titles:title, prop:properties, rvdiffto:diffto, rvlimit:limit, rvprop:rvprop, rvdir:dir, rvstart:latestTimestamp });

	request(api_url, function(err, res, body) {

		if (err) throw err;
		var data = JSON.parse(body);
		var revisions = data.query.pages["983"].revisions;
		var otext;
		var latestRevision = revisions[revisions.length-1];
		latestTimestamp = latestRevision.timestamp;

		for (var i=0; i<revisions.length; i++) {			

			if (revisions[i].diff.hasOwnProperty("notcached")) {
				latestRevision = revisions[i];
				latestTimestamp = latestRevision.timestamp;
				break;
			}

			console.log(k);

			k++;
		}

		if (latestTimestamp < maxTimestamp) f(latestTimestamp, k);
		else cb(null, "yo");

	});

}