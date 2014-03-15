var cheerio = require("cheerio"),
	fs = require("fs"),
	qs = require("querystring"),
	request = require("request"),
	xml2js = require("xml2js"),
	deepcopy = require("deepcopy"),
	uu = require("underscore");

var api_root_url = "http://en.wikipedia.org/w/api.php?",
	export_root_url = "http://en.wikipedia.org/w/index.php?";

var format = "json",
	title = "Albert_Camus",
	properties = "revisions",
	diffto = "next",
	limit = 5,
	rvprop = "user|ids|timestamp",
	dir = "newer";

var latest;

var editHistory;
var historyFlow = [];

var export_url = export_root_url + qs.stringify({title:"Special:Export",dir:"desc",pages:title,action:"submit",history:""});
var api_url;

request(export_url, function (err, res, body) {
	if (!err && res.statusCode == 200) {
		xml2js.parseString(body, function (err, result) {
			editHistory = uu.sortBy(result.mediawiki.page[0].revision, function (d) { return new Date(d.timestamp); });
			f(latest, 0);
		});
	}
});

function f (latest, k) {

	if (latest) api_url = api_root_url + qs.stringify({format:format, action:"query", titles:title, prop:properties, rvdiffto:diffto, rvlimit:limit, rvprop:rvprop, rvdir:dir, rvstart:latest });
	else api_url = api_root_url + qs.stringify({format:format, action:"query", titles:title, prop:properties, rvdiffto:diffto, rvlimit:limit, rvprop:rvprop, rvdir:dir });

	console.log(api_url);
	request(api_url, function (err, res, body) {

		if (err) throw err;
		var data = JSON.parse(body);
		var revisions = data.query.pages["983"].revisions;
		var otext;
		latest = revisions[revisions.length-1].timestamp;
		
		for (var i=0; i<revisions.length; i++) {

			console.log(k);
			
			if (revisions[i].diff.hasOwnProperty("notcached")) {
				console.log("Not cached!");
				latest = revisions[i].timestamp;
				break;
			}
			
			var ntext = editHistory[k].text[0]._;
			var timestamp = revisions[i].timestamp;
			var contributor = revisions[i].user;
			
			if (k == 0) {
				// Initialize history flow.
				historyFlow.push({
					contributions: [{
						start: 0,
						leng: ntext.length,
						contributor: contributor,
						timestamp: timestamp
					}],
					timestamp: timestamp,
					text: ntext
				});
				otext = ntext;
				k++;
				continue;
			};

			var revision = {
				contributions: deepcopy(historyFlow[k-1].contributions), // Clones previous list of contributions so it can be modified without affecting the previous revision.
				timestamp: timestamp,
				text: ntext
			};

			var $ = cheerio.load(revisions[i].diff["*"]);

			var additions = [];
			var deletions = [];

			$("tr").each(function (i,el) {
				if ($(".diff-context",this).length > 0) {
					// deletions.push({context: $(this).children(".diff-context").first().text()});
					// additions.push({context: $(this).children(".diff-context").last().text()});
				} else {
					if ($(".diff-deletedline",this).length > 0) {
						var span = {open:0,close:0};
						var spanArray = [];
						do {
							spanArray.push(span);
							span = {
								open: span.close + $(".diff-deletedline",this).html().slice(spanArray[spanArray.length-1].close).indexOf('<span class="diffchange diffchange-inline">'),
								close: span.close + $(".diff-deletedline",this).html().slice(spanArray[spanArray.length-1].close).indexOf("</span>") + "</span>".length
							};
						} while (span.open >= spanArray[spanArray.length-1].close);

						for (var i=1; i<spanArray.length; i++) {
							var c1 = $(".diff-deletedline",this).html().slice(spanArray[i-1].close, spanArray[i].open);
							c1 = c1.replace(/<div>/g,"");
							c1 = c1.replace(/<\/div>/g,"");

							var d = $(".diff-deletedline",this).html().slice(spanArray[i].open, spanArray[i].close);
							d = d.replace('<span class="diffchange diffchange-inline">',"");
							d = d.replace("</span>","");

							var c2;
							if (i+1 < spanArray.length-1) c2 = $(".diff-deletedline",this).html().slice(spanArray[i].close, spanArray[i+1].open);
							else c2 = $(".diff-deletedline",this).html().slice(spanArray[i].close);
							c2 = c2.replace(/<div>/g,"");
							c2 = c2.replace(/<\/div>/g,"");

							var edit_start = ntext.indexOf(c1 + d + c2);
							edit_start += c1.length;
							var edit_stop = edit_start + d.length;
							console.log("Edit start: " + edit_start);
							console.log("Edit stop: " + edit_stop);
							// removePart(d, edit_start, edit_stop, revision.contributions);
						}
					};

					if ($(".diff-addedline",this).length > 0) {
						var span = {open:0,close:0};
						var spanArray = [];
						do {
							spanArray.push(span); 
							span = {
								open: span.close + $(".diff-addedline",this).html().slice(spanArray[spanArray.length-1].close).indexOf('<span class="diffchange diffchange-inline">'),
								close: span.close + $(".diff-addedline",this).html().slice(spanArray[spanArray.length-1].close).indexOf("</span>") + "</span>".length
							};
						} while (span.open >= spanArray[spanArray.length-1].close);

						for (var i=1; i<spanArray.length; i++) {
							var c1 = $(".diff-addedline",this).html().slice(spanArray[i-1].close, spanArray[i].open).toString();
							c1 = c1.replace(/<div>/g,"");
							c1 = c1.replace(/<\/div>/g,"");

							var a = $(".diff-addedline",this).html().slice(spanArray[i].open, spanArray[i].close).toString();

							var c2;
							if (i+1 < spanArray.length-1) c2 = $(".diff-addedline",this).html().slice(spanArray[i].close, spanArray[i+1].open).toString();
							else c2 = $(".diff-addedline",this).html().slice(spanArray[i].close).toString();
							c2 = c2.replace(/<div>/g,"");
							c2 = c2.replace(/<\/div>/g,"");

							var edit_start = ntext.indexOf(c1 + a + c2);
							edit_start += c1.length;
							var edit_stop = edit_start + a.length;
							console.log("Edit start: " + edit_start);
							console.log("Edit stop: " + edit_stop);
							// addPiece(a, contributor, timestamp, edit_start, edit_stop, revision.contributions);
						}
					};
				}
			});

			historyFlow.push(revision);
			k++;
		}

		// if (revisions[revisions.length-1].diff.to !== 0) f(latest, k);

	});

}