// Offscreen document: holds the real <audio> so playback survives the side panel closing.
const audio = document.getElementById("player");

function state() {
  return {
    src: audio.src,
    currentTime: audio.currentTime,
    duration: isFinite(audio.duration) ? audio.duration : NaN,
    paused: audio.paused,
  };
}

function emit(type) {
  chrome.runtime.sendMessage({ target: "panel", type, state: state() }).catch(() => {});
}

["timeupdate", "loadedmetadata", "play", "pause", "ended", "error"].forEach((t) =>
  audio.addEventListener(t, () => emit(t)),
);

function tryPlay() {
  audio.play().catch(() => emit("playfailed"));
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.target !== "offscreen") return;
  const p = msg.payload;
  switch (msg.cmd) {
    case "load":
      audio.src = p.src;
      audio.playbackRate = p.rate ?? 1;
      audio.volume = p.volume ?? 1;
      audio.muted = !!p.muted;
      break;
    case "play": tryPlay(); break;
    case "pause": audio.pause(); break;
    case "seek": audio.currentTime = p; break;
    case "volume": audio.volume = p; break;
    case "muted": audio.muted = p; break;
    case "rate": audio.playbackRate = p; break;
  }
  sendResponse({ state: state() });
});
