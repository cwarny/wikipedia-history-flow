import java.text.SimpleDateFormat;
import java.text.ParseException;
import java.util.Date;
import java.util.Locale;

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
