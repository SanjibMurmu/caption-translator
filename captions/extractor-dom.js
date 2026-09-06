// captions/extractor-dom.js
//
// Last-resort extractor for sites that render their own captions and don't
// expose them as a standard TextTrack at all (YouTube being the canonical
// example - it draws captions from an internal format into styled DOM spans).
//
// Because there's no timestamp metadata here, this extractor is fundamentally
// LIVE/incremental: it can only tell you about a cue once it's already on
// screen, never in advance. That means true "batch translate the whole
// transcript upfront" isn't possible through this path alone - see content.js
// for how the live-translate-and-swap flow works instead.

const DOM_CAPTION_SELECTORS = [
  ".ytp-caption-segment", // YouTube
  ".vjs-text-track-cue", // video.js-based players
  '[data-purpose="captions-cue-text"]', // Udemy-style players
  '[aria-live] [class*="caption" i]', // generic best-effort heuristic
];

const DOMExtractor = {
  name: "dom",

  canHandle() {
    return DOM_CAPTION_SELECTORS.some((sel) => document.querySelector(sel));
  },

  _findContainer() {
    for (const sel of DOM_CAPTION_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) return { el, selector: sel };
    }
    return null;
  },

  // Streaming API (deliberately different shape from the other two extractors,
  // since this one can't return a finished array). Calls onCue(cue) every time
  // new caption text appears. Returns a controller so the caller can swap in a
  // translated string for whatever's currently on screen, or stop watching.
  startWatching(video, onCue) {
    const found = this._findContainer();
    if (!found) return null;

    let lastText = "";
    let cueCounter = 0;
    let currentCueId = null;

    const observer = new MutationObserver(() => {
      const el = document.querySelector(found.selector);
      const text = el ? el.textContent.trim() : "";
      if (text && text !== lastText) {
        lastText = text;
        currentCueId = `dom-${cueCounter++}`;
        onCue({
          id: currentCueId,
          start: video.currentTime,
          end: null, // unknowable until the text changes again
          text,
        });
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return {
      stop: () => observer.disconnect(),
      // Only swap the DOM text if the cue we're translating is still the one
      // on screen - avoids a race where a slow translation lands after the
      // caption has already moved on to the next line.
      replaceCurrentTextIfStillActive: (cueId, translatedText) => {
        if (cueId !== currentCueId) return false;
        const el = document.querySelector(found.selector);
        if (el) el.textContent = translatedText;
        return true;
      },
    };
  },
};

window.__captionTranslator = window.__captionTranslator || {};
window.__captionTranslator.DOMExtractor = DOMExtractor;
