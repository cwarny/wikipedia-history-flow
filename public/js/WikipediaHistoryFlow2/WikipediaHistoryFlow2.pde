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

HashMap<String,Integer[]> cm = new HashMap<String,Integer[]>();
SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.ENGLISH);
float revisionCount;

void setup() {
  background(0);
  size(displayWidth, displayHeight);
  noStroke();

  MongoClient mongoClient = null;
  try {
    mongoClient = new MongoClient();
  } 
  catch (Exception e) {
  }

  DB db = mongoClient.getDB("wikipedia");
  DBCollection revisions = db.getCollection("revisions");

  revisionCount = (float) revisions.count();
  revisionCount *= 10;
  
  float xScale = width / revisionCount;
  float yScale = height / 42183.0;
  translate(0, (1-yScale) * height);
  scale(xScale, yScale);
  
  DBCursor cursor = revisions.find();
  try {
    while (cursor.hasNext ()) {
      DBObject dbo = cursor.next();
      render(dbo);
    }
  } 
  finally {
    cursor.close();
    println("Done");
  }
  
  save("out/" + year() + month() + day() + hour() + minute() + second() + ".png"); // Save a snapshot
}

void render(DBObject rev) {
  Date timestamp = null;
  try {
    timestamp = dateFormat.parse((String) rev.get("timestamp"));
  } 
  catch (ParseException pe) {
    pe.printStackTrace();
  }

  BasicBSONList contribs = (BasicBSONList) rev.get("contributions");
  int x = int(rev.get("_id").toString()) * 10;
  for (int i=0; i<contribs.size(); i++) {
    DBObject contrib = (DBObject) contribs.get(i);
    Date contribTimestamp = null;
    try {
      contribTimestamp = dateFormat.parse(contrib.get("timestamp").toString());
    } 
    catch (ParseException pe) {
      pe.printStackTrace();
    }
    int y1start = height - int(contrib.get("start").toString());
    int leng = int(contrib.get("leng").toString());
    int slope = int(contrib.get("slope").toString());
    int y1stop = y1start - leng;
    int y0stop = y1stop + slope;
    int y0start;
//    if (contribTimestamp.equals(timestamp)) y0start = y1start + slope;
//    else y0start = y1start + slope;
    y0start = y1start + slope;
      
    int x0 = x;
    int x1 = x + 10;
      
    DBObject contributor = (DBObject) contrib.get("contributor");
    String id;
    try {
      id = contributor.get("username").toString();
    } catch (NullPointerException npe) {
      id = contributor.get("ip").toString();
    }     
    if (!cm.containsKey(id)) {
      Integer[] colorArray = {int(random(255)), int(random(255)), int(random(255))};
      cm.put(id, colorArray);
    }
      
    Integer[] ca = cm.get(id);
    fill(ca[0], ca[1], ca[2]);
    if (!contribTimestamp.equals(timestamp)) {
      beginShape();
        vertex(x0, y0start);
        vertex(x1, y1start);
        vertex(x1, y1stop);
        vertex(x0, y0stop);
  //      vertex(x0, y1start);
  //      vertex(x1, y1start);
  //      vertex(x1, y1stop);
  //      vertex(x0, y1stop);
      endShape(CLOSE);
    } else {
      rect(x1, y1stop, 1, leng);
    }
  }
}

