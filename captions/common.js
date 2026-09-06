// captions/common.js
// The single shared data shape every extractor must produce:
//   { id: string, start: number|null, end: number|null, text: string }
// start/end are seconds (matching video.currentTime). For DOM-scraped cues,
// `end` is often null until the text changes (we don't know the future).

window.__captionTranslator = window.__captionTranslator || {};

class CaptionStore {
  constructor() {
    this.cues = new Map(); // id -> cue
    this.order = []; // insertion order, for sources where sort-by-start isn't meaningful yet
    this.complete = false; // true once we know no more cues will arrive (full-transcript sources)
  }

  addCue(cue) {
    if (!this.cues.has(cue.id)) this.order.push(cue.id);
    this.cues.set(cue.id, cue);
  }

  addCues(cues) {
    cues.forEach((c) => this.addCue(c));
  }

  updateCueEnd(id, endTime) {
    const cue = this.cues.get(id);
    if (cue) cue.end = endTime;
  }

  markComplete() {
    this.complete = true;
  }

  // Sorted by start time where known, otherwise by insertion order.
  getSorted() {
    return this.order
      .map((id) => this.cues.get(id))
      .filter(Boolean)
      .sort((a, b) => {
        if (a.start == null || b.start == null) return 0;
        return a.start - b.start;
      });
  }

  size() {
    return this.cues.size;
  }
}

window.__captionTranslator.CaptionStore = CaptionStore;
