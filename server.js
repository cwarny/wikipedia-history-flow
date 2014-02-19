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

function f(j) {
	console.log(j);
	var ntext = editHistory[j].text[0]._; if (ntext === undefined) ntext = "";
	ntext = ntext.replace(/\r+/g,"").replace(/\n+/g,"\n");
	var timestamp = editHistory[j].timestamp[0];
	var contributor = editHistory[j].contributor[0];
	for (var k in contributor) contributor[k] = contributor[k][0];
	if (editHistory[j].hasOwnProperty("comment")) var comment = editHistory[j].comment[0];
	else var comment = "";
	
	var revision;

	if (j == 0) {
		revision = {
			contributions: [{
				start: 0,
				leng: ntext.length,
				contributor: contributor,
				timestamp: timestamp
			}],
			timestamp: timestamp
			// text: ntext
		};
	} else {
		revision = {
			// contributions: deepcopy(historyFlow[j-1].contributions), // Clones previous list of contributions so it can be modified without affecting the previous revision.
			contributions: deepcopy(previousRevision.contributions),
			timestamp: timestamp
			// text: ntext
		};
		if (comment.search(/Reverted/g) === -1) {
			var diff = jsdiff.diffLines(otext,ntext); // Calculates differences between two strings.
			
			/* * *
			 * We are going to loop through the differences (either an addition, a removal or neither).
			 * For each difference, we are going to modify the revision.
			 * * */

			var edit_start = 0;
			for (var i=0; i<diff.length; i++) {
				if (diff[i].added) {
					if (i+1 < diff.length && diff[i+1].removed && diff[i].value.length < 3000 && diff[i+1].value.length < 3000) {
						// In-line change
						var difff = jsdiff.diffWords(diff[i+1].value, diff[i].value);
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
						// Pure addition
						var edit_stop = edit_start + diff[i].value.length;
						addPiece(diff[i], contributor, timestamp, edit_start, edit_stop, revision.contributions);
						edit_start += diff[i].value.length;
					}
				} else if (diff[i].removed) {
					if (i === 0 || !diff[i-1].added || diff[i-1].value.length > 3000 || diff[i].value.length > 3000) {
						// Pure deletion
						removePart(diff[i], edit_start, edit_stop, revision.contributions);
					}
				} else {
					edit_start += diff[i].value.length;
				}
			}
		}		
	}
	// historyFlow.push(revision);
	previousRevision = revision;
	otext = ntext;
	console.log(revision.timestamp);
	fs.appendFile("history_flow.json", JSON.stringify(revision, null, "\t") + "\n", function (err) {
		if (err) throw err;
		console.log("Revision saved to file.");
		j++;
		if (j < editHistory.length) f(j);
	});
}

request(url, function (err,res,body) {
	console.log("Data grabbed.");
	if (!err && res.statusCode == 200) {
		xml2js.parseString(body, function (err,result) {
			console.log("XML parsed.");
			editHistory = uu.sortBy(result.mediawiki.page[0].revision, function (d) { return new Date(d.timestamp); });
			f(0);
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