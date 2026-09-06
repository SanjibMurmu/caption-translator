# Caption Translator 🌐

Caption Translator is a lightweight, Chromium-based browser extension (Manifest V3) that translates video subtitles into your preferred language in real time, powered by **Azure AI Translator**.

## Overview

Caption Translator sits between your browser and whatever captions a video already has — a WebVTT track, a native `<track>` element, or a site's own DOM-rendered caption overlay (like YouTube's) — and rewrites them into the language you choose, on the fly. Standard HTML5 videos get their full transcript translated upfront in one batch pass, while custom caption overlays are translated line-by-line as they appear, so playback never has to pause and wait on a network call.

## Features

* 🎬 **Upfront batch translation (`full` mode)** — extracts the full WebVTT transcript or native track, batches requests up to 100 cues per call, and builds a cleanly synced subtitle track on the HTML5 player
* 🚫 **Native caption suppression** — detaches conflicting `<track>` elements and mutes default browser cue rendering so only your translated captions show
* 📡 **Live in-place translation (`live` mode)** — watches custom caption DOM containers on sites without native `<track>` elements, translating sentences as they stream in
* 🌍 **Automatic language detection** — identifies the video's spoken caption language via Azure AI Translator and labels the track accordingly (e.g., `Translated (en → es)`)
* ⚡ **In-memory caching** — skips duplicate network requests for lines you've already translated when rewinding or looping
* 🔒 **Zero hardcoded secrets** — you supply your own Azure Cognitive Services key and region in the popup, stored locally via `chrome.storage.local`

## Tech Stack

* JavaScript (vanilla, Manifest V3 service worker + content scripts)
* Azure AI Translator (Cognitive Services) API
* HTML5 `<video>` / `TextTrack` APIs, MutationObserver for DOM-based captions
* Chrome Extensions APIs (`chrome.storage`, `chrome.runtime`)

## How It Works

A router script inspects each video on the page and picks the best extraction strategy: pulling cues straight from `video.textTracks`, fetching the raw WebVTT file, or falling back to a MutationObserver watching a site's custom caption container. Extracted lines are batched and sent from the background service worker to Azure AI Translator, and the translated cues are re-injected as a new track (or swapped into the DOM overlay live), while the content script handles detaching the original captions so only your chosen language is shown.

## Installation

### Option 1: Install from GitHub Releases (recommended)

1. Go to the **Releases** tab in this repository.
2. Download the latest `caption-translator-v*.zip` file and extract it.
3. Open your Chromium browser's extensions manager:
   * **Google Chrome:** `chrome://extensions`
   * **Microsoft Edge:** `edge://extensions`
4. Toggle on **Developer mode**.
5. Click **Load unpacked** and select the extracted folder.

> **Note for local files:** to test on `file:///...` pages, open the extension's **Details** page and enable **"Allow access to file URLs"**.

### Option 2: Clone and run from source

```
git clone https://github.com/SanjibMurmu/live-caption-translator.git
cd live-caption-translator
```

Then open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**, click **Load unpacked**, and select the repository root.

## Getting Started

1. **Get an Azure AI Translator key** — create a free or paid **Translator** resource in the Azure Portal, then copy your **Key 1** (or Key 2) and your resource **Region** (e.g., `eastus`, `global`, `westeurope`).
2. **Configure the extension** — click the extension icon, enter your **Azure API Key** and **Region**, and pick your **Target Language**.
3. **Translate** — open any page playing a video with captions on, click **Translate captions** in the popup, and click **Restore original** to switch back.

## Project Structure

```
├── captions/
│   ├── common.js                  # Shared caption utilities
│   ├── extractor-dom.js           # MutationObserver fallback for DOM-rendered captions
│   ├── extractor-native-track.js  # Extracts cues via HTML5 video.textTracks
│   ├── extractor-vtt-fetch.js     # Fallback to direct WebVTT file fetching
│   └── router.js                  # Selects best extraction strategy per video
├── icons/                         # Extension icons (16, 48, 128 px)
├── .github/workflows/
│   └── release.yml                # Automated CI packaging and GitHub release creation
├── background.js                  # Service worker handling Azure batch translation calls
├── content.js                     # Content script managing track replacement and DOM cleanup
├── manifest.json                  # Manifest V3 extension configuration
├── popup.html                     # Extension interface for API key, region, and language selection
├── popup.js                       # Saves settings to local storage and triggers translation
└── vtt-parser.js                  # Parses raw WebVTT strings into timed cue arrays
```

## Security & Privacy

* **No remote telemetry** — this extension does not log, track, or transmit your data to any third-party analytics or external server
* **Direct authenticated requests** — translation payloads go straight from your browser's background service worker to `https://api.cognitive.microsofttranslator.com`
* **Local credential storage** — API keys and preferences live exclusively on your device via `chrome.storage.local`

## License

This project is licensed under the [MIT License](LICENSE).
