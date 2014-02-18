var jsdiff = require("diff"),
	request = require("request"),
	xml2js = require("xml2js"),
	qs = require("querystring"),
	fs = require("fs"),
	uu = require("underscore"),
	deepcopy = require("deepcopy");

var burl = "http://en.wikipedia.org/w/index.php?";

var title = "Special:Export";
var dir = "desc";
var action = "submit";
var page = "Albert_Camus";

var url = burl + qs.stringify({title:title,dir:dir,pages:page,action:action,history:""});

// var historyFlow = [];
var previousRevision;
var editHistory;
var otext = "";

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

function f(i) {
	console.log(i);
	var ntext = editHistory[i].text[0]._; if (ntext === undefined) ntext = "";
	var timestamp = editHistory[i].timestamp[0];
	var contributor = editHistory[i].contributor[0]; 
	for (var k in contributor) contributor[k] = contributor[k][0];
	if (i == 0) {
		// Initialize history flow.
		// historyFlow.push({
		// 	contributions: [{
		// 		start: 0,
		// 		leng: ntext.length,
		// 		contributor: contributor,
		// 		timestamp: timestamp
		// 	}],
		// 	timestamp: timestamp,
		// 	text: ntext
		// });
		previousRevision = {
			contributions: [{
				start: 0,
				leng: ntext.length,
				contributor: contributor,
				timestamp: timestamp
			}],
			timestamp: timestamp,
			// text: ntext
		};
		otext = ntext;
		i++;
		f(i);
	}
	var revision = {
		// contributions: deepcopy(historyFlow[i-1].contributions), // Clones previous list of contributions so it can be modified without affecting the previous revision.
		contributions: deepcopy(previousRevision.contributions),
		timestamp: timestamp,
		text: ntext
	};
	console.log("Size of old text: " + otext.length);
	console.log("Number of contributions: " + revision.contributions.length);
	var diff = jsdiff.diffLines(otext,ntext); // Calculates differences between two strings.
	
	/* * *
	 * We are going to loop through the differences (either an addition, a removal or neither).
	 * For each difference, we are going to modify the revision.
	 * * */

	var edit_start = 0;
	diff.forEach(function (part) {
		var edit_stop = edit_start + part.value.length;
		if (part.added) {
			addPiece(part, contributor, timestamp, edit_start, edit_stop, revision.contributions);
			edit_start += part.value.length;
		} else if (part.removed) {
			removePart(part, edit_start, edit_stop, revision.contributions);
		} else {
			edit_start += part.value.length;
		}
	});

	// historyFlow.push(revision);
	previousRevision = revision;
	otext = ntext;
	console.log(revision.timestamp);
	fs.appendFile("history_flow.json", JSON.stringify(revision, null, "\t"), function (err) {
		if (err) throw err;
		console.log("Revision saved to file.");
		i++
		f(i);
	});
}

request(url, function (err,res,body) {
	console.log("Data grabbed.");
	if (!err && res.statusCode == 200) {
		xml2js.parseString(body, function (err,result) {
			console.log("XML parsed.");
			editHistory = uu.sortBy(result.mediawiki.page[0].revision, function (d) { return new Date(d.timestamp); });
			f(0);
			// fs.writeFile("history_flow.json", JSON.stringify(historyFlow, null, "\t"), function (err) {
			// 	if (err) throw err;
			// 	console.log("History flow saved to file.");
			// });
		});
	}
});

function addPiece (newPiece, contributor, timestamp, edit_start, edit_stop, contributions) {
	
	/* * *
	 * We loop through the previous revision pieces to find where the difference 
	 * we are currently looking at falls. Adapt the starting points and lengths
	 * of each affected piece, then splice the new piece in the contributions array.
	 * * */

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

function removePart (part, edit_start, edit_stop, contributions) {

	/* * *
	 * We loop through the previous revision pieces to find where the difference 
	 * we are currently looking at falls. Adapt the starting points and lengths
	 * of each affected piece.
	 * * */

	var indicesToSplice = [];
	for (var j=0; j<contributions.length; j++) {
		var piece_start = contributions[j].start;
		var piece_stop = contributions[j].start + contributions[j].leng;
		if (piece_start <= edit_start) {
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
		if (indicesToSplice.length > 1) Array.prototype.multisplice.apply(contributions,indicesToSplice);
		else contributions.splice(indicesToSplice[0],1);
	}
}

var edit_start = 0;
for (var i=0; i<diff.length; i++) {
	if (diff[i].added) {
		if (diff[i+1].removed) {
			console.log("In-line change");
			var difff = jsdiff.diffChars(diff[i].value, diff[i+1].value);
			difff.forEach(function (part) {
				var edit_stop = edit_start + part.value.length;
				if (part.added) {
					addPiece(part, contributor, timestamp, edit_start, edit_stop, revision.contributions);
					edit_start += part.value.length;
				} else if (part.removed) {
					removePart(part, edit_start, edit_stop, revision.contributions);
				} else {
					edit_start += part.value.length;
				}
			});
		} else {
			console.log("Pure addition");
			var edit_stop = edit_start + diff[i].value.length;
			addPiece(diff[i], contributor, timestamp, edit_start, edit_stop, revision.contributions);
			edit_start += diff[i].value.length;
		}
	} else if (diff[i].removed && !diff[i-1].added) {
		console.log("Pure deletion");
		removePart(diff[i], edit_start, edit_stop, revision.contributions);
	} else {
		edit_start += diff[i].value.length;
	}
}