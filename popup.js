const keyInput = document.getElementById("azureKeyInput");
const regionInput = document.getElementById("azureRegionInput");
const langSelect = document.getElementById("langSelect");
const translateBtn = document.getElementById("translateBtn");
const restoreBtn = document.getElementById("restoreBtn");
const statusEl = document.getElementById("status");

function setStatus(text) {
  statusEl.textContent = text;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Restore saved settings
chrome.storage.local.get(["azureKey", "azureRegion", "targetLang"], (result) => {
  if (result.azureKey) keyInput.value = result.azureKey;
  if (result.azureRegion) regionInput.value = result.azureRegion;
  if (result.targetLang) langSelect.value = result.targetLang;
});

translateBtn.addEventListener("click", async () => {
  const azureKey = keyInput.value.trim();
  const azureRegion = regionInput.value.trim();
  const targetLang = langSelect.value;

  if (!azureKey) {
    setStatus("Error: Please provide your Azure API Key.");
    return;
  }

  chrome.storage.local.set({ azureKey, azureRegion, targetLang });

  const tab = await getActiveTab();
  setStatus("Translating...");
  translateBtn.disabled = true;

  chrome.tabs.sendMessage(
    tab.id,
    { type: "TRANSLATE_PAGE", targetLang },
    (response) => {
      translateBtn.disabled = false;
      if (chrome.runtime.lastError) {
        setStatus("Error: Refresh the video page or allow file URL access in extension details.");
        return;
      }
      if (response && response.ok) {
        setStatus(`Translated captions for ${response.count} video(s).`);
      } else {
        setStatus(`Error: ${response ? response.error : "unknown"}`);
      }
    }
  );
});

restoreBtn.addEventListener("click", async () => {
  const tab = await getActiveTab();
  chrome.tabs.sendMessage(tab.id, { type: "RESTORE_ORIGINAL" }, (response) => {
    if (chrome.runtime.lastError) {
      setStatus("Error: Content script not loaded. Refresh tab.");
      return;
    }
    setStatus("Restored original captions.");
  });
});