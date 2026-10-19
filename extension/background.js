// AudiFiya service worker: opens the side panel and owns the offscreen audio document.
const OFFSCREEN_URL = "audio.html";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

let creating = null;
async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  if (!creating) {
    creating = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_URL,
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Keep music playing when the side panel is closed",
      })
      .finally(() => { creating = null; });
  }
  await creating;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.target !== "background") return;
  (async () => {
    if (msg.cmd === "getState" && !(await chrome.offscreen.hasDocument())) {
      sendResponse(null);
      return;
    }
    await ensureOffscreen();
    const res = await chrome.runtime
      .sendMessage({ target: "offscreen", cmd: msg.cmd, payload: msg.payload })
      .catch(() => null);
    sendResponse(res);
  })();
  return true;
});
