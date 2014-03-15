import java.util.Collections;
import java.util.Comparator;
import java.util.regex.Matcher;
import java.util.regex.Pattern;


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
	initGlobalVariables();
	revisionCount = data.length;
	rectW = map(timeWindowLength, 0, revisionCount, 0, width - textAreaWidth);
	data.forEach(function(d) {
		d.w = revWidth;
		d.timestamp = new Date(d.timestamp);
		d.id = parseFloat(d._id);
		d.x = d.id * d.w;
		d.nLines = 0;
		d.contributions.forEach(function(c) {
			d.nLines += c.nLines;
			if (i == d.contributions.length-1) d.size = (mainChartHeight - c.y1start) + c.leng;
			c.timestamp = new Date(c.timestamp);
			c.stop = c.start + c.leng;
			c.snippet = d.text.slice(c.start, c.stop);
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
			Matcher matcher = pattern.matcher(snippet);
			int k = 0;
			while (matcher.find()) k++;
			nLines += k;
		});
		    
		    y1start = mainChartHeight - start;
		    y1stop = y1start - leng;
		    slope = int(contrib.get("slope").toString());
		    y0stop = y1stop + slope;
		    y0start = y1start + slope;
		      
		    DBObject contr = (DBObject) contrib.get("contributor");
		    String id;
		    try {
		      id = contr.get("username").toString();
		    } catch (NullPointerException npe) {
		      id = contr.get("ip").toString();
		    }
		    if (!contributors.containsKey(id)) {
		      contributor = new Contributor(id);
		      contributors.put(id, contributor);
		    } else {
		      contributor = contributors.get(id);
		    }
		}
    
		if (d.size > absoluteMaxSize) absoluteMaxSize = d.size;
	});
	data = _.sortBy(data, function(d) { return d.id; });
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
	var patt = /\n|\r/mg;
	mainChartHeight = height - bottomChartHeight;
	a = textAscent();
	d = textDescent();
	textLeading(a);
	revWidth = timeWindowLength/100;
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
  
	Date timestamp = null;
	float id;
	float x;
	float w;
	float size;
	String text;
	float nLines = 0;
	ArrayList<Contribution> contributions = new ArrayList<Contribution>();
  
	Revision(DBObject rev) {
		w = revWidth;
		try {
			timestamp = dateFormat.parse((String) rev.get("timestamp"));
		} 
		catch (ParseException pe) {
			pe.printStackTrace();
		}
		BasicBSONList contribs = (BasicBSONList) rev.get("contributions");
		id = float(rev.get("_id").toString());
		x = id * w;
		text = rev.get("text").toString();
    
		for (int i=0; i<contribs.size(); i++) {
			DBObject contrib = (DBObject) contribs.get(i);
			Contribution c = new Contribution(contrib, this);
			nLines += c.nLines;
			if (i == contribs.size()-1) size = (mainChartHeight - c.y1start) + c.leng;
			contributions.add(c);
		}
    
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

}

class Contribution {
  
  Revision rev;
  Contributor contributor;
  Date timestamp = null;
  float y1start, y1stop, y0start, y0stop;
  int start, leng;
  int slope;
  float x0, x1;
  float nLines = 1;
  
  Contribution(DBObject contrib, Revision rev) {
    this.rev = rev;
    try {
      timestamp = dateFormat.parse(contrib.get("timestamp").toString());
    } 
    catch (ParseException pe) {
      pe.printStackTrace();
    }
    
    leng = int(contrib.get("leng").toString());
    start = int(contrib.get("start").toString());
    calcNLines();
    
    y1start = mainChartHeight - start;
    y1stop = y1start - leng;
    slope = int(contrib.get("slope").toString());
    y0stop = y1stop + slope;
    y0start = y1start + slope;
      
    DBObject contr = (DBObject) contrib.get("contributor");
    String id;
    try {
      id = contr.get("username").toString();
    } catch (NullPointerException npe) {
      id = contr.get("ip").toString();
    }
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
    Matcher matcher = pattern.matcher(snippet);
    int k = 0;
    while (matcher.find()) k++;
    nLines += k;
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
}