// content.js

function findAllVideos() {
  return Array.from(document.querySelectorAll("video"));
}

function requestTranslation(texts, targetLang) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "TRANSLATE_CUES", texts, targetLang },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response || !response.ok) {
          reject(new Error(response ? response.error : "No response from background"));
          return;
        }
        resolve({
          translatedTexts: response.translatedTexts,
          sourceLang: response.sourceLang
        });
      }
    );
  });
}

// Completely detaches original <track> tags from the DOM to stop browsers from auto-rendering them
function disableOriginalTracks(video, keepTrack) {
  if (!video.__originalTrackElements) {
    video.__originalTrackElements = [];
  }

  const trackEls = Array.from(video.querySelectorAll("track"));
  trackEls.forEach((el) => {
    if (el.track !== keepTrack) {
      video.__originalTrackElements.push({
        element: el,
        parent: el.parentNode,
        nextSibling: el.nextSibling,
        default: el.hasAttribute("default"),
        src: el.getAttribute("src"),
        srclang: el.getAttribute("srclang"),
        label: el.getAttribute("label"),
        kind: el.getAttribute("kind")
      });
      el.removeAttribute("default");
      if (el.track) el.track.mode = "disabled";
      el.remove();
    }
  });

  Array.from(video.textTracks).forEach((t) => {
    if (t !== keepTrack) {
      t.mode = "disabled";
    }
  });
}

function captureActiveTrack(video) {
  return (
    Array.from(video.textTracks).find(
      (t) => (t.kind === "subtitles" || t.kind === "captions") && t.mode === "showing"
    ) || null
  );
}

// --- "full" mode ---
async function translateFullTranscript(video, extraction, targetLang, onProgress) {
  const { cues } = extraction;
  const originallyActiveTrack = captureActiveTrack(video);

  onProgress?.(`Translating ${cues.length} lines via Azure...`);
  const { translatedTexts, sourceLang } = await requestTranslation(
    cues.map((c) => c.text),
    targetLang
  );

  onProgress?.("Building translated caption track...");
  const label = `Translated (${sourceLang} → ${targetLang})`;
  const newTrack = video.addTextTrack("subtitles", label, targetLang);

  cues.forEach((cue, i) => {
    newTrack.addCue(new VTTCue(cue.start, cue.end, translatedTexts[i]));
  });

  // Strip native track DOM tags so they stop rendering
  disableOriginalTracks(video, newTrack);
  newTrack.mode = "showing";

  // Prevent host player event loops from resetting mode back to showing
  const trackChangeListener = () => {
    Array.from(video.textTracks).forEach((t) => {
      if (t !== newTrack && t.mode === "showing") {
        t.mode = "disabled";
      }
    });
  };
  video.textTracks.addEventListener("change", trackChangeListener);

  video.__captionTranslatorTrack = newTrack;
  video.__captionTranslatorOriginalTrack = originallyActiveTrack;
  video.__captionTranslatorListener = trackChangeListener;

  onProgress?.("Done");
  return { kind: "full", track: newTrack };
}

// --- "live" mode ---
async function translateLiveDOM(video, targetLang, onProgress) {
  const { DOMExtractor } = window.__captionTranslator;
  const cache = new Map();

  const controller = DOMExtractor.startWatching(video, async (cue) => {
    let translated = cache.get(cue.text);
    if (translated === undefined) {
      try {
        const { translatedTexts } = await requestTranslation([cue.text], targetLang);
        translated = translatedTexts[0];
        cache.set(cue.text, translated);
      } catch (e) {
        console.error("Live caption translation failed:", e);
        return;
      }
    }
    controller.replaceCurrentTextIfStillActive(cue.id, translated);
  });

  if (!controller) throw new Error("Could not find a caption overlay to watch");

  video.__captionTranslatorDOMController = controller;
  onProgress?.("Watching live captions...");
  return { kind: "live", controller };
}

async function translateVideo(video, targetLang, onProgress) {
  const { extractTranscript } = window.__captionTranslator;
  const extraction = await extractTranscript(video);

  if (!extraction) {
    throw new Error(
      "No captions found (checked native TextTrack, VTT file, and known caption overlays)"
    );
  }

  onProgress?.(`Found captions via: ${extraction.source}`);

  if (extraction.mode === "full") {
    return translateFullTranscript(video, extraction, targetLang, onProgress);
  }
  return translateLiveDOM(video, targetLang, onProgress);
}

function restoreOriginal(video) {
  if (video.__captionTranslatorListener) {
    video.textTracks.removeEventListener("change", video.__captionTranslatorListener);
    video.__captionTranslatorListener = null;
  }

  if (video.__captionTranslatorTrack) {
    video.__captionTranslatorTrack.mode = "disabled";
    video.__captionTranslatorTrack = null;
  }

  // Restore removed <track> elements back to the video tag
  if (video.__originalTrackElements && video.__originalTrackElements.length > 0) {
    video.__originalTrackElements.forEach((saved) => {
      const restoredTrackEl = document.createElement("track");
      if (saved.kind) restoredTrackEl.kind = saved.kind;
      if (saved.src) restoredTrackEl.src = saved.src;
      if (saved.srclang) restoredTrackEl.srclang = saved.srclang;
      if (saved.label) restoredTrackEl.label = saved.label;
      if (saved.default) restoredTrackEl.default = true;

      if (saved.nextSibling && saved.parent.contains(saved.nextSibling)) {
        saved.parent.insertBefore(restoredTrackEl, saved.nextSibling);
      } else {
        video.appendChild(restoredTrackEl);
      }
    });
    video.__originalTrackElements = [];
  }

  const original = video.__captionTranslatorOriginalTrack;
  if (original) {
    original.mode = "showing";
    video.__captionTranslatorOriginalTrack = null;
  }

  const domController = video.__captionTranslatorDOMController;
  if (domController) {
    domController.stop();
    video.__captionTranslatorDOMController = null;
  }
}

// --- Message bridge to the popup ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_VIDEO_STATUS") {
    sendResponse({ videoCount: findAllVideos().length });
    return;
  }

  if (message.type === "TRANSLATE_PAGE") {
    const videos = findAllVideos();
    if (videos.length === 0) {
      sendResponse({ ok: false, error: "No <video> element found on this page" });
      return true;
    }

    Promise.allSettled(
      videos.map((video) => translateVideo(video, message.targetLang))
    ).then((results) => {
      const succeeded = results.filter((r) => r.status === "fulfilled");
      const failed = results.filter((r) => r.status === "rejected");

      if (succeeded.length === 0) {
        sendResponse({
          ok: false,
          error: failed[0]?.reason?.message || "No video could be captioned",
        });
      } else {
        sendResponse({
          ok: true,
          count: succeeded.length,
          skipped: failed.length,
        });
      }
    });
    return true;
  }

  if (message.type === "RESTORE_ORIGINAL") {
    findAllVideos().forEach(restoreOriginal);
    sendResponse({ ok: true });
    return;
  }
});