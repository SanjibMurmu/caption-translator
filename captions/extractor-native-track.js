// captions/extractor-native-track.js
//
// Key idea: instead of fetching and parsing the .vtt file ourselves, we let the
// browser do it. Setting a TextTrack's mode to "hidden" (not "disabled") tells
// the browser to keep parsing the track and populating `track.cues` /
// `track.activeCues`, it just stops rendering its own caption overlay.
//
// Once loaded, `track.cues` holds the FULL list of cues for the entire video
// (already parsed by the browser), not just the currently-active one - so this
// gives us the whole upfront transcript for free, with zero VTT-parsing code,
// and it works even if the file is behind CORS or a blob: URL we couldn't fetch.

function findSubtitleTrackElement(video) {
  return Array.from(video.querySelectorAll("track")).find(
    (t) => t.kind === "subtitles" || t.kind === "captions"
  );
}

function waitForTrackCues(track, timeoutMs) {
  return new Promise((resolve) => {
    if (track.cues && track.cues.length > 0) {
      resolve(track.cues);
      return;
    }

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearInterval(pollHandle);
      resolve(result);
    };

    // Fast path: some browsers fire 'load' on the <track> element once parsed
    track.oncuechange = () => {
      if (track.cues && track.cues.length > 0) finish(track.cues);
    };

    // Reliable fallback: poll, since load/cuechange timing is inconsistent
    // across browsers and can fire before cues are actually populated.
    const start = Date.now();
    const pollHandle = setInterval(() => {
      if (track.cues && track.cues.length > 0) {
        finish(track.cues);
      } else if (Date.now() - start > timeoutMs) {
        finish(null);
      }
    }, 150);
  });
}

const NativeTrackExtractor = {
  name: "native-track",

  canHandle(video) {
    return !!findSubtitleTrackElement(video);
  },

  // Returns { cues, trackEl, track } on success, or null if cues never populate
  // (caller should fall back to VTTFetchExtractor).
  async extract(video, { timeoutMs = 4000 } = {}) {
    const trackEl = findSubtitleTrackElement(video);
    if (!trackEl) return null;

    const track = trackEl.track;
    const previousMode = track.mode;
    track.mode = "hidden"; // parse without rendering the native overlay

    const rawCues = await waitForTrackCues(track, timeoutMs);
    if (!rawCues || rawCues.length === 0) {
      track.mode = previousMode; // give up cleanly, let the fallback extractor try
      return null;
    }

    const cues = Array.from(rawCues).map((cue, i) => ({
      id: cue.id || `native-${i}`,
      start: cue.startTime,
      end: cue.endTime,
      text: cue.text,
    }));

    return { cues, trackEl, track };
  },
};

window.__captionTranslator = window.__captionTranslator || {};
window.__captionTranslator.NativeTrackExtractor = NativeTrackExtractor;
window.__captionTranslator.findSubtitleTrackElement = findSubtitleTrackElement;
