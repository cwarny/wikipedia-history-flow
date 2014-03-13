class RevisionComparator implements Comparator<Revision> {
    int compare(Revision rev1, Revision rev2) {
        return Float.compare(rev1.id, rev2.id);
    }
}
