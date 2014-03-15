import com.mongodb.MongoClient;
import com.mongodb.MongoException;
import com.mongodb.WriteConcern;
import com.mongodb.DB;
import com.mongodb.DBCollection;
import com.mongodb.BasicDBObject;
import com.mongodb.DBObject;
import com.mongodb.DBCursor;
import com.mongodb.ServerAddress;
import java.text.SimpleDateFormat;
import java.text.ParseException;
import java.util.Date;
import java.util.Locale;
import java.util.Collections;
import java.util.Comparator;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.ENGLISH);

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
Pattern pattern;

void setup() {
  background(0);
  size(displayWidth, displayHeight);
  initGlobalVariables();

  MongoClient mongoClient = null;
  try { mongoClient = new MongoClient(); }
  catch (Exception e) {}

  DB db = mongoClient.getDB("wikipedia");
  DBCollection collection = db.getCollection("revisions");

  revisionCount = (float) collection.count();
  
  rectW = map(timeWindowLength, 0, revisionCount, 0, width - textAreaWidth);
  
  DBCursor cursor = collection.find();
  try {
    while (cursor.hasNext()) {
      DBObject dbo = cursor.next();
      revisions.add(new Revision(dbo));
    }
  } 
  finally {
    cursor.close();
  }
  
  Collections.sort(revisions, new RevisionComparator());
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
  pattern = Pattern.compile("\n|\r");
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
