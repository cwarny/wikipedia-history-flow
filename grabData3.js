var jsdiff = require("diff"),
	request = require("request"),
	xml2js = require("xml2js"),
	qs = require("querystring"),
	fs = require("fs"),
	uu = require("underscore"),
	async = require("async"),
	deepcopy = require("deepcopy"),
	mongodb = require("mongodb");

var MONGODB_URI = "mongodb://localhost/wikipedia",
	db,
	revisions;

var burl = "http://en.wikipedia.org/w/index.php?";

var title = "Special:Export";
var dir = "desc";
var action = "submit";
var page = "Albert_Camus";

var url = burl + qs.stringify({title:title,dir:dir,pages:page,action:action,history:""});

var diffs;
var prevRev = [{},{}];

mongodb.MongoClient.connect(MONGODB_URI, function (err, database) {
	if (err) throw err;
	db = database;
	revisions = db.collection("revisions");
	request(url, function (err, res, body) {
		console.log("Data grabbed.");
		if (!err && res.statusCode == 200) {
			xml2js.parseString(body, function (err, results) {
				console.log("XML parsed.");
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
				async.map(z, function (item, cb) { 
					cb(null, dif(item)); 
				}, function (err, res) { 
					diffs = res; 
					console.log("Diffs calculated.");
					f(0);
				});
			});
		}
	});
});

// Functions

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

function dif(item) {
	var diff = jsdiff.diffLines(item[0].text, item[1].text);
	var rev = {data: deepcopy(item[1]), edits: diff};
	return rev;
}

function f(i) {
	// console.log("i: " + i);
	var rev;
	if (i == 0) {
		rev = {
			contributions: [{
				start: 0,
				leng: diffs[i].data.text.length,
				contributor: diffs[i].data.contributor,
				timestamp: diffs[i].data.timestamp
			}],
			timestamp: diffs[i].data.timestamp,
			text: diffs[i].data.text,
			_id: i
		};
	} else {
		if (diffs[i].data.comment.search(/Reverted/g) !== -1 && prevRev[prevRev.length-2].text === diffs[i].data.text) {
			rev = {
				contributions: deepcopy(prevRev[prevRev.length-2].contributions),
				timestamp: diffs[i].data.timestamp,
				text: diffs[i].data.text,
				_id: i
			};
		} else {
			rev = {
				contributions: deepcopy(prevRev[prevRev.length-1].contributions),
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
	// console.log("Contributions length: " + contributions.length);
	// console.log("Edit start: " + edit_start);
	// console.log("Edit stop: " + edit_stop);
	for (var j=0; j<contributions.length; j++) {
		var piece_start = contributions[j].start;
		var piece_stop = piece_start + contributions[j].leng;
		// console.log("Piece start: " + piece_start);
		// console.log("Piece stop: " + piece_stop);
		if (piece_start < edit_start) {
			if (edit_start <= piece_stop) {
				indexToSplice = j+1;
				contributions[j].leng = edit_start - piece_start;
				if (edit_start != piece_stop) {
					// console.log("Ajoutons");
					contributions.splice(j+1,0,{
						start: edit_start, // Will be bumped by part.value.length at next iteration of for loop
						leng: piece_stop - edit_start,
						contributor: contributions[j].contributor,
						timestamp: contributions[j].timestamp
					});
				}
			}
		} else {
			contributions[j].start += newPiece.value.length;
		}
	}

	// console.log("Index to splice: " + indexToSplice);

	contributions.splice(indexToSplice, 0, {
		start: edit_start,
		leng: newPiece.value.length,
		contributor: contributor,
		timestamp: timestamp
	});
	// if (indexToSplice) console.log("Contributions length after splicing: " + contributions.length);
}

function removePart (part, edit_start, edit_stop, contributions) {

	// We loop through the previous revision pieces to find where the difference 
	// we are currently looking at falls. Adapt the starting points and lengths
	// of each affected piece.

	var indicesToSplice = [];
	for (var j=0; j<contributions.length; j++) {
		var piece_start = contributions[j].start;
		var piece_stop = contributions[j].start + contributions[j].leng;
		if (piece_start < edit_start) {
			if (piece_stop >= edit_start) {
				if (piece_stop < edit_stop) {
					contributions[j].leng = edit_start - piece_start;
				} else {
					contributions[j].leng -= part.value.length;
				}
			}
		} else {
			if (piece_start < edit_stop) {
				if (piece_stop <= edit_stop) {
					indicesToSplice.push(j);
				} else {
					contributions[j].start = edit_start;
					contributions[j].leng = piece_stop - edit_stop;
				}
			} else {
				contributions[j].start -= part.value.length;
			}
		}
	}
	if (indicesToSplice.length > 0) {
		// console.log("Indices to delete: " + indicesToSplice.toString());
		if (indicesToSplice.length > 1) Array.prototype.multisplice.apply(contributions,indicesToSplice);
		else contributions.splice(indicesToSplice[0],1);
	}
}

