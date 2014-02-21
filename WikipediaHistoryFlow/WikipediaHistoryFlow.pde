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



SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.ENGLISH);
int revisionCount;

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

  revisionCount = int(revisions.count());

  revisions.command(new BasicDBObject("aggregate", new BasicDBObject("$project")));
  
  DBCursor cursor = revisions.find();
  try {
    while (cursor.hasNext ()) {
      DBObject dbo = cursor.next();
      renderRect(dbo);
    }
  } 
  finally {
    cursor.close();
    println("Done");
  }
}

void renderRect(DBObject rev) {
  Date timestamp;
  try {
    timestamp = dateFormat.parse((String) rev.get("timestamp"));
  } 
  catch (ParseException pe) {
    pe.printStackTrace();
  }

  BasicBSONList contribs = (BasicBSONList) rev.get("contributions");
  int j = int(rev.get("_id").toString());
  for (int i=0; i<contribs.size(); i++) {
    DBObject contrib = (DBObject) contribs.get(i);
    int start = int(contrib.get("start").toString());
    int leng = int(contrib.get("leng").toString());

    float y = map(start, 0, 42183, height, 0);
    float h = map(leng, 0, 42183, 0, height);
    float x = map(j, 0, revisionCount, 0, width);
    float w = 1;
    fill(random(255), random(255), random(255));
    rect(x, y, w, h);
  }
}

