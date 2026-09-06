// vtt-parser.js
// Parses raw WebVTT text into an array of cue objects: { id, startTime, endTime, text }
// startTime/endTime are in seconds (floats), matching video.currentTime's unit.

const VTT_TIME_RE =
  /(\d{2}:)?(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}:)?(\d{2}):(\d{2})\.(\d{3})/;

function timeToSeconds(hh, mm, ss, ms) {
  const h = hh ? parseInt(hh, 10) : 0;
  return h * 3600 + parseInt(mm, 10) * 60 + parseInt(ss, 10) + parseInt(ms, 10) / 1000;
}

function parseVTT(raw) {
  // Normalize line endings, split into blank-line-separated blocks
  const blocks = raw.replace(/\r\n/g, "\n").split(/\n\s*\n/);
  const cues = [];
  let autoId = 0;

  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim() !== "" || l === "");
    if (lines.length === 0) continue;

    // Find the timestamp line within this block (skip WEBVTT header / cue-id line)
    let timeLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (VTT_TIME_RE.test(lines[i])) {
        timeLineIndex = i;
        break;
      }
    }
    if (timeLineIndex === -1) continue; // e.g. the "WEBVTT" header block

    const match = lines[timeLineIndex].match(VTT_TIME_RE);
    const startTime = timeToSeconds(match[1], match[2], match[3], match[4]);
    const endTime = timeToSeconds(match[5], match[6], match[7], match[8]);

    const text = lines
      .slice(timeLineIndex + 1)
      .join("\n")
      .trim();

    if (!text) continue;

    // Optional cue identifier is the line before the timestamp, if present and not itself a timestamp
    const idLine = timeLineIndex > 0 ? lines[timeLineIndex - 1].trim() : "";
    const id = idLine || String(autoId++);

    cues.push({ id, startTime, endTime, text });
  }

  return cues;
}

// Not strictly needed (we build cues via VTTCue directly) but useful for debugging/export
function cuesToVTT(cues) {
  let out = "WEBVTT\n\n";
  cues.forEach((cue, i) => {
    out += `${i + 1}\n${formatTime(cue.startTime)} --> ${formatTime(cue.endTime)}\n${cue.text}\n\n`;
  });
  return out;
}

function formatTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const ms = Math.round((totalSeconds - Math.floor(totalSeconds)) * 1000);
  const pad = (n, len = 2) => String(n).padStart(len, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

// Expose to content.js (both loaded as plain content scripts, sharing global scope)
window.__captionTranslator = window.__captionTranslator || {};
window.__captionTranslator.parseVTT = parseVTT;
window.__captionTranslator.cuesToVTT = cuesToVTT;
