ArrayList<A> myAs = new ArrayList<A>();

void setup() {
	size(200,200);
	background(0);
	var myArray = [1,9,8];
	myArray.forEach(function(x) {
		myAs.add(new A(x));
	});
	myAs = _.sortBy(myAs.toArray(), function(a) { return a.n; });
	for (A x : myAs) {
		console.log(x.n);
	}
	var d1 = new Date("2009-08-09");
	var d2 = new Date("2009-08-10");
	var d3 = new Date("2009-08-09");
	console.log(d1.equals(d2));
	console.log(d1.equals(d3));
	// console.log(data);
}

void draw() {
	background(0);
	fill(255, 0, 0);
	for (A x : myAs) {
		x.render();
	}
}

class A {

	float x, y;
	int n;
	
	A(var n) {
		this.n = n;
		x = random(0, width);
		y = random(0, height);
	}

	void render() {
		text(n, x, y);
	}

}