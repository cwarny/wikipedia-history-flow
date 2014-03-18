var express = require("express"),
	app = express(),
	path = require("path"),
	mongodb = require("mongodb");

var MONGODB_URI = "mongodb://localhost/wikipedia",
	db,
	revisions;

app.configure(function() {
	app.set("port", process.env.PORT || 3000);
	app.use(express.static(path.join(__dirname, "public")));
	app.use(express.favicon());
	app.use(express.logger());
	app.use(express.bodyParser());
	app.use(express.cookieParser());
	app.use(express.methodOverride());
	app.use(express.session({secret: "keyboard cat"}));
	app.use(app.router);
});

mongodb.MongoClient.connect(MONGODB_URI, function(err, database) {
	if (err) throw err;
	db = database;
	revisions = db.collection("revisions");
	var server = app.listen(process.env.PORT || 3000);
	console.log("Express server started on port %s", server.address().port);
});

app.get("/", function(req, res) {
	res.sendfile("index.html");
});

app.get("/article/:id", function(req, res){
	console.log(req.params.id);
	revisions.find().toArray(function(err, results) {
		res.json(results.slice(0,500));
	});
});