// background.js
const AZURE_TRANSLATOR_ENDPOINT = "https://api.cognitive.microsofttranslator.com";
const BATCH_SIZE = 100; // Azure accepts up to 100 array items per call

async function getAzureCredentials() {
  const data = await chrome.storage.local.get(["azureKey", "azureRegion"]);
  return {
    key: data.azureKey || "",
    region: data.azureRegion || ""
  };
}

async function translateBatchAzure(texts, targetLang, credentials) {
  // Omitting 'from' parameter enables Azure automatic source language detection
  const url = `${AZURE_TRANSLATOR_ENDPOINT}/translate?api-version=3.0&to=${encodeURIComponent(targetLang)}`;
  const body = texts.map((text) => ({ Text: text }));

  const headers = {
    "Content-Type": "application/json",
    "Ocp-Apim-Subscription-Key": credentials.key
  };

  if (credentials.region) {
    headers["Ocp-Apim-Subscription-Region"] = credentials.region;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Azure translation failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return data.map((item) => ({
    text: item.translations[0].text,
    detectedLang: item.detectedLanguage ? item.detectedLanguage.language : null
  }));
}

async function translateAllCues(texts, targetLang) {
  const credentials = await getAzureCredentials();
  if (!credentials.key) {
    throw new Error("Azure Translator API key is missing. Set it in the popup.");
  }

  const results = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchResults = await translateBatchAzure(batch, targetLang, credentials);
    results.push(...batchResults);
  }

  const detectedLanguages = results.map((r) => r.detectedLang).filter(Boolean);
  const dominantLang = detectedLanguages.length > 0 ? detectedLanguages[0] : "auto";

  return {
    translatedTexts: results.map((r) => r.text),
    sourceLang: dominantLang
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TRANSLATE_CUES") {
    translateAllCues(message.texts, message.targetLang)
      .then((data) => sendResponse({ ok: true, ...data }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true; // async reply
  }
});