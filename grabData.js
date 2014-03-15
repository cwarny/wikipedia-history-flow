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
	var rev = {data: deepcopy(item[1]), edits: []};
	for (var i=0; i<diff.length; i++) {
		if (diff[i].added) {
			if (i+1 < diff.length && diff[i+1].removed && diff[i].value.length < 3000 && diff[i+1].value.length < 3000) {
				// In-line change
				var difff = jsdiff.diffWords(diff[i+1].value, diff[i].value);
				rev.edits.push.apply(rev.edits, difff);
			} else {
				// Pure addition
				rev.edits.push(diff[i]);
			}
		} else if (diff[i].removed) {
			if (i === 0 || !diff[i-1].added || diff[i-1].value.length > 3000 || diff[i].value.length > 3000) {
				// Pure deletion
				rev.edits.push(diff[i]);
			}
		} else {
			rev.edits.push(diff[i]);
		}
	}
	return rev;
}

function f(i) {
	console.log(i);
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
				if (part.added) {
					var edit_stop = edit_start + part.value.length;
					addPiece(part, diffs[i].data.contributor, diffs[i].data.timestamp, edit_start, edit_stop, rev.contributions);
					edit_start += part.value.length;
				} else if (part.removed) {
					if (part.value[part.value.length-1] == "\n" && part.value.length > 1) leng = part.value.length - 1;
					else leng = part.value.length;
					var edit_stop = edit_start + leng;
					removePart(part, edit_start, edit_stop, leng, rev.contributions);
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

	var indexToSplice;
	for (var j=0; j<contributions.length; j++) {
		var piece_start = contributions[j].start;
		var piece_stop = contributions[j].start + contributions[j].leng;
		if (piece_start < edit_start) {
			if (edit_start <= piece_stop) {
				indexToSplice = j+1;
				contributions[j].leng = edit_start - piece_start;
				if (edit_start != piece_stop) {
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

	contributions.splice(indexToSplice, 0, {
		start: edit_start,
		leng: newPiece.value.length,
		contributor: contributor,
		timestamp: timestamp
	});
}

function removePart (part, edit_start, edit_stop, leng, contributions) {

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
					contributions[j].leng -= leng;
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
				contributions[j].start -= leng;
			}
		}
	}
	if (indicesToSplice.length > 0) {
		if (indicesToSplice.length > 1) Array.prototype.multisplice.apply(contributions,indicesToSplice);
		else contributions.splice(indicesToSplice[0],1);
	}
}

