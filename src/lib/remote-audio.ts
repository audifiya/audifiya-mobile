import { chromeApi, isExtension } from "./extension-env";

/**
 * Audio-element look-alike used in extension mode. Commands go to the
 * background service worker, which forwards them to an offscreen document
 * that owns the real <audio>, so music survives closing the side panel.
 */
class RemoteAudio extends EventTarget {
  private _src = "";
  private _time = 0;
  private _duration = NaN;
  private _paused = true;
  private _volume = 1;
  private _muted = false;
  private _rate = 1;
  private pendingPlay: { resolve: () => void; reject: (e: unknown) => void }[] = [];

  constructor() {
    super();
    const c = chromeApi();
    c?.runtime.onMessage.addListener((msg: any) => {
      if (!msg || msg.target !== "panel") return;
      if (msg.state) this.applyState(msg.state);
      switch (msg.type) {
        case "play":
          this._paused = false;
          this.pendingPlay.splice(0).forEach((p) => p.resolve());
          break;
        case "pause":
          this._paused = true;
          break;
        case "playfailed":
          this.pendingPlay.splice(0).forEach((p) => p.reject(new Error("play failed")));
          break;
      }
      if (msg.type && msg.type !== "playfailed" && msg.type !== "state") {
        this.dispatchEvent(new Event(msg.type));
      }
    });
    // Re-sync with audio that kept playing while the panel was closed.
    void this.send("getState").then((res: any) => {
      if (res?.state) {
        this.applyState(res.state);
        this.dispatchEvent(new Event(res.state.paused ? "pause" : "play"));
        this.dispatchEvent(new Event("loadedmetadata"));
        this.dispatchEvent(new Event("timeupdate"));
      }
    });
  }

  private applyState(s: any) {
    if (typeof s.currentTime === "number") this._time = s.currentTime;
    if (typeof s.duration === "number") this._duration = s.duration;
    if (typeof s.paused === "boolean") this._paused = s.paused;
    if (typeof s.src === "string" && s.src) this._src = s.src;
  }

  private send(cmd: string, payload?: unknown): Promise<unknown> {
    const c = chromeApi();
    if (!c) return Promise.resolve(null);
    try {
      return c.runtime
        .sendMessage({ target: "background", cmd, payload })
        .catch(() => null);
    } catch {
      return Promise.resolve(null);
    }
  }

  get src() { return this._src; }
  set src(v: string) {
    this._src = v;
    this._time = 0;
    this._duration = NaN;
    void this.send("load", { src: v, rate: this._rate, volume: this._volume, muted: this._muted });
  }
  get currentSrc() { return this._src; }
  get currentTime() { return this._time; }
  set currentTime(v: number) { this._time = v; void this.send("seek", v); }
  get duration() { return this._duration; }
  get paused() { return this._paused; }
  get volume() { return this._volume; }
  set volume(v: number) { this._volume = v; void this.send("volume", v); }
  get muted() { return this._muted; }
  set muted(v: boolean) { this._muted = v; void this.send("muted", v); }
  get playbackRate() { return this._rate; }
  set playbackRate(v: number) { this._rate = v; void this.send("rate", v); }

  play(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.pendingPlay.push({ resolve, reject });
      void this.send("play");
      setTimeout(() => {
        const i = this.pendingPlay.findIndex((p) => p.resolve === resolve);
        if (i >= 0) { this.pendingPlay.splice(i, 1); resolve(); }
      }, 8000);
    });
  }
  pause() { void this.send("pause"); }
  load() { /* handled by offscreen */ }
  removeAttribute(_n: string) { /* noop */ }
}

let remote: RemoteAudio | null = null;

/** The player's audio element: native <audio> on the web, remote shim in the extension. */
export function getAudio(): HTMLAudioElement | null {
  if (typeof document === "undefined") return null;
  if (isExtension()) {
    if (!remote) remote = new RemoteAudio();
    return remote as unknown as HTMLAudioElement;
  }
  return document.getElementById("nativeAudio") as HTMLAudioElement | null;
}
