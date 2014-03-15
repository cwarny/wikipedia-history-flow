class Contributor {

  String id;
  color col;
  
  Contributor(String id) {
    this.id = id;
    col = color(random(255), random(255), random(255));
  }
  
}
