var App = Ember.Application.create();

App.Router.map(function() {
	this.resource("article", { path: "article/:article_id" })
});

App.ApplicationRoute = Ember.Route.extend({

});

App.ArticleRoute = Ember.Route.extend({
	model: function(params) {
		// return { revisions: "res" };
		return $.get("/article/" + params.article_id).then(function(res) {
			return { revisions: res };
		});
	}
});

App.CanvasView = Ember.View.extend({
	tagName: "canvas",
	attributeBindings: ["id"],
	id: "pjs"
});

App.ProcessingCanvasComponent = Ember.Component.extend({
	didInsertElement: function() {
		Ember.run.once(this, "drawCanvas");
	},
	drawCanvas: function () {
		var canvas = document.getElementById("pjs");
		var sketch = new Processing.Sketch();
		sketch.attachFunction = buildSketchFunction(this.get("data"));
		var p = new Processing(canvas, sketch);
	}.observes("data")
});

