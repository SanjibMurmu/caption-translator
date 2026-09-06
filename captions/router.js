// captions/router.js
// Tries extractors in order of preference: the ones that give a full,
// timestamped transcript upfront are strictly better (real batch translation,
// clean replay) than the DOM live-scrape fallback, so we only fall through to
// DOM scraping when nothing else is available.

async function extractTranscript(video) {
  const { NativeTrackExtractor, VTTFetchExtractor, DOMExtractor } = window.__captionTranslator;

  if (NativeTrackExtractor.canHandle(video)) {
    const result = await NativeTrackExtractor.extract(video);
    if (result) return { mode: "full", source: "native-track", ...result };
  }

  if (VTTFetchExtractor.canHandle(video)) {
    const result = await VTTFetchExtractor.extract(video);
    if (result) return { mode: "full", source: "vtt-fetch", ...result };
  }

  if (DOMExtractor.canHandle()) {
    return { mode: "live", source: "dom" };
  }

  return null;
}

window.__captionTranslator = window.__captionTranslator || {};
window.__captionTranslator.extractTranscript = extractTranscript;
