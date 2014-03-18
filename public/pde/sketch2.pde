HashMap<String,Contributor> contributors = new HashMap<String,Contributor>();
ArrayList<Revision> revisions = new ArrayList<Revision>();
float revisionCount;
float xScale, yScale;
float timeStart = 0; 
float timeWindowLength = 100;
float revWidth;
float relativeMaxSize;
float absoluteMaxSize = MIN_FLOAT;
float bottomChartHeight = 200;
float mainChartHeight;
float textAreaWidth = 400;
float rectX, rectW;
Revision selectedRevision;
float a, d;
var patt;

void setup() {
	background(0);
	size(displayWidth, displayHeight);
	revisionCount = data.length;
	initGlobalVariables();
	for (var i=data.length-1; i>=0; i--) {
		revisions.add(new Revision(data[i]));
		data.splice(i,1);
	}
	revisions = _.sortBy(revisions.toArray(), function(rev) { return rev.id; });
}

void draw() {
	background(0);
	updateScales();
	renderMainChart();
	renderBottomChart();
	renderSelectedRevision();
}

void mousePressed() {
	if (mouseY > mainChartHeight && mouseY < height && (mouseX < rectX || mouseX > rectX + rectW)) {
		rectX = mouseX;
		timeStart = map(rectX, 0, width - textAreaWidth, 0, revisionCount);
	}
}

void mouseDragged() {
	if (mouseY > mainChartHeight && mouseY < height && mouseX > rectX && mouseX < rectX + rectW) {
		rectX = rectX + (mouseX - pmouseX);
		timeStart = map(rectX, 0, width - textAreaWidth, 0, revisionCount);
	}
}

void initGlobalVariables() {
	patt = /\n|\r/mg;
	mainChartHeight = height - bottomChartHeight;
	a = textAscent();
	d = textDescent();
	textLeading(a);
	revWidth = timeWindowLength/100;
	rectW = map(timeWindowLength, 0, revisionCount, 0, width - textAreaWidth);
}

void updateScales() {
	relativeMaxSize = 0;
	for (Revision rev : revisions) {
		if (rev.id > timeStart && rev.id < timeStart + timeWindowLength) {
			if (rev.size > relativeMaxSize) relativeMaxSize = rev.size;
		}
	}
  
	float xDomain = (timeWindowLength-1) * revWidth + revWidth*10;
	xScale = (width - textAreaWidth) / xDomain;
	yScale = mainChartHeight / relativeMaxSize;
}

void renderMainChart() {
	pushMatrix();
		translate(0, (1-yScale) * mainChartHeight);
		scale(xScale, yScale);
	
		float prevX = 0;
		float prevW = 0;
		noStroke();
		for (Revision rev : revisions) {
			if (rev.id > timeStart && rev.id < timeStart + timeWindowLength) {
				rev.update(prevX, prevW);
				rev.render();
				prevX = rev.x;
				prevW = rev.w;      
			}
		}
	popMatrix();
}

void renderBottomChart() {
	stroke(255);
	noFill();
	beginShape();
		for (Revision rev : revisions) {
			float bx = map(rev.id, 0, revisionCount, 0, width - textAreaWidth);
			float by = map(rev.size, 0, absoluteMaxSize, height, height - bottomChartHeight);
			curveVertex(bx, by);
		}
	endShape();
	fill(255, 100);
	noStroke();
	rect(rectX, mainChartHeight, rectW, bottomChartHeight);
}

void renderSelectedRevision() {
	float yText = 0;
	float selectedRevisionScreenHeight = map(selectedRevision.size, 0, relativeMaxSize, 0, mainChartHeight);
	if (mouseY < mainChartHeight) yText -= map(mouseY, mainChartHeight - selectedRevisionScreenHeight, mainChartHeight, a*selectedRevision.nLines + d, 0);
	for (Contribution contrib : selectedRevision.contributions) {
		fill(contrib.contributor.col);
		String snippet = selectedRevision.text.substring(contrib.start, contrib.start + contrib.leng);
		text(snippet, width - textAreaWidth, yText, textAreaWidth, yText + a * contrib.nLines + d);
		yText += a * contrib.nLines + d;
	}
}

class Revision {
  
	var timestamp;
	float id;
	float x;
	float w;
	float size;
	String text;
	float nLines = 0;
	ArrayList<Contribution> contributions = new ArrayList<Contribution>();
  
	Revision(var rev) {
		w = revWidth;
		timestamp = new Date(rev.timestamp); 
		id = parseFloat(rev._id);
		x = id * w;
		text = rev.text;
    	rev.contributions.forEach(function(contrib) {
    		Contribution c = new Contribution(contrib, this);
			nLines += c.nLines;
			if (i == contribs.size()-1) size = (mainChartHeight - c.y1start) + c.leng;
			contributions.add(c);
    	});
    
		if (size > absoluteMaxSize) absoluteMaxSize = size;
	}
  
	void update(float prevX, float prevW) {
		x = prevX + prevW;
		if (mouseX/xScale >= x && mouseX/xScale < x + w) {
			w = revWidth * 10;
			selectedRevision = this;
		} else {
			w = revWidth;
		}
	}  

	void render() {
		for (Contribution contrib : contributions) {
			contrib.render();
		}
	}

};

class Contribution {
  
	Revision rev;
	Contributor contributor;
	var timestamp;
	float y1start, y1stop, y0start, y0stop;
	int start, leng;
	int slope;
	float x0, x1;
	float nLines = 1;
  
	Contribution(var contrib, Revision rev) {
		this.rev = rev;
		timestamp = new Date(contrib.timestamp); 
    
		leng = contrib.leng;
		start = contrib.start;
		calcNLines();
    
		y1start = mainChartHeight - start;
		y1stop = y1start - leng;
		slope = contrib.slope;
		y0stop = y1stop + slope;
		y0start = y1start + slope;
      
		var id;
		if (contrib.contributor.hasOwnProperty("username")) id = contrib.contributor.username;
		else id = contrib.contributor.ip;
		if (!contributors.containsKey(id)) {
			contributor = new Contributor(id);
			contributors.put(id, contributor);
		} else {
			contributor = contributors.get(id);
		}
	}
  
	void calcNLines() {
		int stop = start + leng;
		String snippet = rev.text.substring(start, stop);
		String[] tokens = splitTokens(snippet);
		float lineX = 0;
		for (int i=0; i<tokens.length; i++) {
			if (lineX + textWidth(tokens[i]) > textAreaWidth) {
				nLines++;
				lineX = textWidth(tokens[i] + " ") ;
			} else if (lineX + textWidth(tokens[i]) == textAreaWidth) {
				nLines++;
				lineX = 0;
			} else {
				lineX += textWidth(tokens[i] + " ");
			}
		}
		nLines += snippet.match(patt).length;
	}
  
	void render() {
		x0 = rev.x;
		x1 = x0 + rev.w;
		fill(contributor.col);
		if (!timestamp.equals(rev.timestamp)) {
			beginShape();
				vertex(x0, y0start);
				vertex(x1, y1start);
				vertex(x1, y1stop);
				vertex(x0, y0stop);
			endShape(CLOSE);
		} else {
			rect(x1, y1stop, 1, leng);
		}
	}

};

class Contributor {

	String id;
	color col;
  
	Contributor(String id) {
		this.id = id;
		col = color(random(255), random(255), random(255));
	}

};
