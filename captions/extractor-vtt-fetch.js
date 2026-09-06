// captions/extractor-vtt-fetch.js
//
// Fallback for when NativeTrackExtractor can't get the browser to populate
// track.cues (e.g. some older Chromium versions don't parse "hidden" tracks
// as eagerly as "showing" ones). Fetches and parses the .vtt file directly -
// this is the original approach from v0, kept as a safety net.

const VTTFetchExtractor = {
  name: "vtt-fetch",

  canHandle(video) {
    const trackEl = window.__captionTranslator.findSubtitleTrackElement(video);
    return !!(trackEl && trackEl.src);
  },

  async extract(video) {
    const trackEl = window.__captionTranslator.findSubtitleTrackElement(video);
    if (!trackEl || !trackEl.src) return null;

    let vttText;
    try {
      const res = await fetch(trackEl.src);
      if (!res.ok) return null;
      vttText = await res.text();
    } catch (e) {
      return null; // e.g. CORS-blocked - let the caller know this path failed
    }

    const parsed = window.__captionTranslator.parseVTT(vttText);
    if (parsed.length === 0) return null;

    const cues = parsed.map((c, i) => ({
      id: c.id || `vtt-${i}`,
      start: c.startTime,
      end: c.endTime,
      text: c.text,
    }));

    return { cues, trackEl, track: trackEl.track };
  },
};

window.__captionTranslator = window.__captionTranslator || {};
window.__captionTranslator.VTTFetchExtractor = VTTFetchExtractor;
