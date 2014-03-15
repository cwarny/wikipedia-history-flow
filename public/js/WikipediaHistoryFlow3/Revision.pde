import java.text.SimpleDateFormat;
import java.text.ParseException;
import java.util.Date;
import java.util.Locale;

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
