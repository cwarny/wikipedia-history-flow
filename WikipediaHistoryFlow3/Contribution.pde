import java.text.SimpleDateFormat;
import java.text.ParseException;
import java.util.Date;
import java.util.Locale;

class Contribution {
  
  Revision rev;
  Contributor contributor;
  Date timestamp = null;
  float y1start, y1stop, y0start, y0stop;
  int leng;
  int slope;
  float x0, x1;
  
  Contribution(DBObject contrib, Revision rev) {
    this.rev = rev;
    try {
      timestamp = dateFormat.parse(contrib.get("timestamp").toString());
    } 
    catch (ParseException pe) {
      pe.printStackTrace();
    }
    
    y1start = mainChartHeight - int(contrib.get("start").toString());
    leng = int(contrib.get("leng").toString());
    slope = int(contrib.get("slope").toString());
    y1stop = y1start - leng;
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
