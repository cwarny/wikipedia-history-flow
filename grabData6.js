var request = require("request"),
	async = require("async"),
	xml2js = require("xml2js"),
	uu = require("underscore"),
	qs = require("querystring"),
	jsdiff = require("diff"),
	deepcopy = require("deepcopy"),
	mongodb = require("mongodb");

var MONGODB_URI = "mongodb://localhost/wikipedia",
	db,
	revisions;

var apiRootUrl = "http://en.wikipedia.org/w/api.php?",
	exportRootUrl = "http://en.wikipedia.org/w/index.php?";

var title = "Albert_Camus",
	properties = "revisions",
	limit = 115,
	dir = "newer",
	fields = "timestamp|ids";

var offsets = [];

var diffs = [];
var prevRev = [{},{}];

mongodb.MongoClient.connect(MONGODB_URI, function (err, database) {
	if (err) throw err;
	db = database;
	revisions = db.collection("revisions");
	console.log("Gathering offsets...");
	gatherOffsets(null, "2014-03-18T17:56:52Z");
});

function gatherOffsets(startid, maxTimestamp) {
	if (startid) var apiUrl = apiRootUrl + qs.stringify({ format:"json", action:"query", titles:title, prop:properties, rvlimit:limit, rvprop:fields, rvdir:dir, rvstartid:startid });
	else var apiUrl = apiRootUrl + qs.stringify({ format:"json", action:"query", titles:title, prop:properties, rvlimit:limit, rvprop:fields, rvdir:dir });
	request(apiUrl, function(err, res, body) {
		var data = JSON.parse(body);
		var revisions = data.query.pages["983"].revisions;
		var latestRev = revisions[revisions.length-1];
		if (!startid) {
			offsets.push(revisions[0].timestamp);
			console.log(revisions[0].timestamp);
		}
		if (revisions.length > 1 && new Date(latestRev.timestamp) < new Date(maxTimestamp)) {
			console.log(latestRev.timestamp);
			offsets.push(latestRev.timestamp);
			gatherOffsets(latestRev.revid, maxTimestamp);
		} else {
			console.log("Done gathering offsets.");
			console.log("Exporting and diffing...");
			async.map(offsets, 
				exportData, 
				function(err, results) {
					console.log("hey");
					for (var i=0; i<results.length-1; i++) {
						if (i > 0) results[i][0].edits = jsdiff.diffLines(results[i][0].data.text, results[i-1][results[i].length-1].data.text);
						diffs.push.apply(diffs, results[i]);
					}
					console.log("Done exporting and diffing.");
					console.log("Calculating revs...");
					f(0);
				}
			);
		}
	});
}

function exportData(offset, cb) {
	var exportUrl = exportRootUrl + qs.stringify({ title:"Special:Export", pages:title, action:"submit", limit:limit, offset:offset });
	request.post(exportUrl, function (err, res, body) { processResponse(offset, err, res, body, cb); });
}

function processResponse(offset, err, res, body, cb1) {
	if (!err && res.statusCode == 200) {
		console.log("Export starting from " + offset + " finished.");
		xml2js.parseString(body, function (err, results) {

			if (results.mediawiki.hasOwnProperty("page")) {

				var editHistory = uu.sortBy(results.mediawiki.page[0].revision, function (d) { return new Date(d.timestamp); });
				editHistory = uu.map(editHistory, function (d) { 
					var text = d.text[0]._; if (text === undefined) text = "";
					text = text.replace(/\r+/g,"").replace(/\n+/g,"\n");
					var timestamp = d.timestamp[0];
					var contributor = d.contributor[0];
					for (var k in contributor) contributor[k] = contributor[k][0];
					if (d.hasOwnProperty("comment")) var comment = d.comment[0];
					else var comment = "";
					return { text: text, timestamp: timestamp, contributor: contributor, comment: comment };
				});

				var editHistoryLag = editHistory.slice(0, editHistory.length-1);
				editHistoryLag.unshift({text: ""});
				var z = uu.zip(editHistoryLag, editHistory);
				async.map(z, 
					dif, 
					function (err, res) { 
						console.log("Diffs for export starting from " + offset + " calculated.");
						cb1(null, res);
					}
				);

			} else {

				cb1(null, []);

			}

		});
	}
}

Array.prototype.multisplice = function () {
	var args = Array.apply(null, arguments);
	args.sort(function (a,b) {
		return a-b;
	});
	for (var i=0; i<args.length; i++) {
		var index = args[i] - i;
		this.splice(index, 1);
	}
}

function dif(item, cb2) {
	var diff = jsdiff.diffLines(item[0].text, item[1].text);
	var rev = {data: deepcopy(item[1]), edits: diff};
	cb2(null, rev);
}

function f(i) {
	var rev;
	if (i == 0) {
		rev = {
			contributions: [{
				start: 0,
				leng: diffs[i].data.text.length,
				contributor: diffs[i].data.contributor,
				timestamp: diffs[i].data.timestamp,
				slope: 0
			}],
			timestamp: diffs[i].data.timestamp,
			text: diffs[i].data.text,
			_id: i
		};
	} else {
		if (diffs[i].data.comment.search(/Reverted/g) !== -1 && prevRev[prevRev.length-2].text === diffs[i].data.text) {
			rev = {
				contributions: prevRev[prevRev.length-2].contributions.map(function (d) {
					return { start: d.start, leng: d.leng, contributor: deepcopy(d.contributor), timestamp: d.timestamp, slope: 0 };
				}),
				timestamp: diffs[i].data.timestamp,
				text: diffs[i].data.text,
				_id: i
			};
		} else {
			rev = {
				contributions: prevRev[prevRev.length-1].contributions.map(function (d) {
					return { start: d.start, leng: d.leng, contributor: deepcopy(d.contributor), timestamp: d.timestamp, slope: 0 };
				}),
				timestamp: diffs[i].data.timestamp,
				text: diffs[i].data.text,
				_id: i
			};
			var edit_start = 0;
			diffs[i].edits.forEach(function (part) {
				// console.log("Edit start: " + edit_start);
				var edit_stop = edit_start + part.value.length;
				// console.log("Edit stop: " + edit_stop);
				if (part.added) {
					addPiece(part, diffs[i].data.contributor, diffs[i].data.timestamp, edit_start, edit_stop, rev.contributions);
					edit_start += part.value.length;
				} else if (part.removed) {
					removePart(part, edit_start, edit_stop, rev.contributions);
				} else {
					edit_start += part.value.length;
				}
			});
		}
	}
	prevRev.shift();
	prevRev.push(rev);
	revisions.insert(rev, {safe: true}, function (err, results) {
		if (err) throw err;
		i++;
		if (i < diffs.length) f(i);
		else console.log("Revs calculated.");
	});
}

function addPiece (newPiece, contributor, timestamp, edit_start, edit_stop, contributions) {
	
	// We loop through the previous revision pieces to find where the difference 
	// we are currently looking at falls. Adapt the starting points and lengths
	// of each affected piece, then splice the new piece in the contributions array.

	var indexToSplice = 0;
	for (var j=0; j<contributions.length; j++) {
		var piece_start = contributions[j].start;
		var piece_stop = piece_start + contributions[j].leng;
		if (piece_start < edit_start) {
			if (edit_start <= piece_stop) {
				indexToSplice = j+1;
				contributions[j].leng = edit_start - piece_start;
				if (edit_start != piece_stop) {
					contributions.splice(j+1,0,{
						start: edit_start, // Will be bumped by part.value.length at next iteration of for loop
						leng: piece_stop - edit_start,
						contributor: contributions[j].contributor,
						timestamp: contributions[j].timestamp,
						slope: contributions[j].slope + newPiece.value.length
					});
				}
			}
		} else {
			contributions[j].start += newPiece.value.length;
			contributions[j].slope += newPiece.value.length;
		}
	}

	contributions.splice(indexToSplice, 0, {
		start: edit_start,
		leng: newPiece.value.length,
		contributor: contributor,
		timestamp: timestamp,
		slope: indexToSplice == 0 ? 0 : contributions[indexToSplice-1].slope
	});
}

function removePart (part, edit_start, edit_stop, contributions) {

	// We loop through the previous revision pieces to find where the difference 
	// we are currently looking at falls. Adapt the starting points and lengths
	// of each affected piece.

	var indicesToSplice = [];
	var indexToSplice, theLeng;

	for (var j=0; j<contributions.length; j++) {
		var piece_start = contributions[j].start;
		var piece_stop = contributions[j].start + contributions[j].leng;
		if (piece_start < edit_start) {
			if (piece_stop >= edit_start) {
				if (piece_stop < edit_stop) {
					contributions[j].leng = edit_start - piece_start;
				} else {
					contributions[j].leng = edit_start - piece_start;
					indexToSplice = j+1;
					theLeng = piece_stop - edit_stop
				}
			}
		} else {
			if (piece_start < edit_stop) {
				if (piece_stop <= edit_stop) {
					indicesToSplice.push(j);
				} else {
					contributions[j].start = edit_start;
					contributions[j].leng = piece_stop - edit_stop;
					contributions[j].slope -= part.value.length;
				}
			} else {
				contributions[j].start -= part.value.length;
				contributions[j].slope -= part.value.length;
			}
		}
	}
	if (indicesToSplice.length > 0) {
		if (indicesToSplice.length > 1) Array.prototype.multisplice.apply(contributions,indicesToSplice);
		else contributions.splice(indicesToSplice[0],1);
	}
	if (indexToSplice) {
		contributions.splice(indexToSplice, 0, {
			start: edit_start,
			leng: theLeng,
			contributor: contributions[indexToSplice-1].contributor,
			timestamp: contributions[indexToSplice-1].timestamp,
			slope: contributions[indexToSplice-1].slope - part.value.length
		});
	}
}


