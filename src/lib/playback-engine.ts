import { isExtension } from "./extension-env";
import { create } from "zustand";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { NativeAudio } from "@capgo/capacitor-native-audio";
import {
  fetchRecommendations,
  fetchSongById,
  getArtistString,
  getStreamUrl,
  getThumbnail,
  type JSSong,
} from "./jiosaavn";
import { pushPlaybackHistory } from "./library";
import { loadSettings, saveSettings } from "./player-settings";

export type RepeatMode = 0 | 1 | 2; // Off, Loop context, Loop track

// Only tracks discovered through search feed the "Recently played" list.
export type PlaySource = "search" | "library";

/** Resolved stream URL + metadata for the upcoming track, cached in memory. */
export interface NextTrackData {
  song: JSSong;
  url: string;
  index: number;
}

interface PlaybackState {
  audioNode: HTMLAudioElement | null;
  nextTrackData: NextTrackData | null;
  currentTrack: JSSong | null;
  queue: JSSong[];
  currentQueueIndex: number;
  historyStack: JSSong[];
  isShuffleActive: boolean;
  isRepeatMode: RepeatMode;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isExpanded: boolean;
  playbackRate: number;

  setExpanded: (v: boolean) => void;
  cyclePlaybackRate: () => void;

  playSource: PlaySource;
  isAutoPlayEnabled: boolean;
  toggleAutoPlay: () => void;
  attachAudio: (node: HTMLAudioElement) => void;
  playContext: (
    queue: JSSong[],
    index: number,
    source?: PlaySource,
    presetUrl?: string | null,
  ) => void;
  playNext: (song: JSSong) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seekPercent: (pct: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  clearNextTrack: () => void;
}

/* -------------------------------------------------------------------------- */
/*  Platform detection                                                        */
/* -------------------------------------------------------------------------- */

/**
 * True only inside the Capacitor Android/iOS shell. On the web and in Electron
 * this is false, so the original HTML5 <audio> logic is used untouched.
 */
const isNative = () => typeof window !== "undefined" && Capacitor.isNativePlatform();

const noop = () => {};

export const usePlayback = create<PlaybackState>((set, get) => ({
  audioNode: null,
  nextTrackData: null,
  currentTrack: null,
  queue: [],
  currentQueueIndex: -1,
  historyStack: [],
  isShuffleActive: false,
  isRepeatMode: 0,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  isMuted: false,
  isExpanded: false,
  playbackRate: 1,
  playSource: "library",
  isAutoPlayEnabled: true,

  toggleAutoPlay: () => {
    const nextVal = !get().isAutoPlayEnabled;
    set({ isAutoPlayEnabled: nextVal });
    saveSettings({
      volume: get().volume,
      speed: get().playbackRate,
      autoplay: nextVal,
    });
  },

  cyclePlaybackRate: () => {
    const rates = [1, 1.25, 1.5, 2, 0.5, 0.75];
    const cur = get().playbackRate;
    const idx = rates.indexOf(cur);
    const nextRate = rates[(idx + 1) % rates.length] ?? 1;
    if (isNative()) {
      if (currentAssetId) {
        NativeAudio.setRate({ assetId: currentAssetId, rate: nextRate }).catch(noop);
      }
    } else {
      const audio = get().audioNode;
      if (audio) audio.playbackRate = nextRate;
    }
    set({ playbackRate: nextRate });
    saveSettings({
      volume: get().volume,
      speed: nextRate,
      autoplay: get().isAutoPlayEnabled,
    });
  },

  setExpanded: (v) => {
    const cur = get().isExpanded;
    if (cur === v) return;
    if (typeof window !== "undefined") {
      if (v) {
        try { window.history.pushState({ playerExpanded: true }, ""); } catch { /* noop */ }
      } else if (window.history.state?.playerExpanded) {
        try { window.history.back(); return; } catch { /* noop */ }
      }
    }
    set({ isExpanded: v });
  },

  attachAudio: (node) => {
    if (get().audioNode === node) return;
    const saved = loadSettings();
    const volume = saved ? saved.volume : get().volume;
    const speed = saved ? saved.speed : get().playbackRate;
    const autoplay = saved?.autoplay !== false;
    node.volume = volume;
    node.playbackRate = speed;
    set({
      audioNode: node,
      volume,
      playbackRate: speed,
      isMuted: volume === 0,
      isAutoPlayEnabled: autoplay,
    });
    // Native shell: make sure the plugin is configured (idempotent).
    void initNativeAudio();
  },

  playContext: (queue, index, source, presetUrl) => {
    const track = queue[index];
    if (!track) return;
    const audio = get().audioNode;
    const src = presetUrl ?? getStreamUrl(track);
    const prev = get().currentTrack;
    // Internal advances (next/prev) omit the source and inherit the queue's origin.
    const playSource: PlaySource = source ?? get().playSource;
    set({
      queue,
      currentQueueIndex: index,
      currentTrack: track,
      playSource,
      // Any context change invalidates the buffered next track.
      nextTrackData: null,
      historyStack: prev ? [...get().historyStack, prev].slice(-50) : get().historyStack,
    });
    if (playSource === "search") {
      try { pushPlaybackHistory(track); } catch { /* noop */ }
    }
    if (!src) return;
    if (isNative()) {
      void nativePlayTrack(track, src);
    } else if (audio) {
      audio.src = src;
      audio.playbackRate = get().playbackRate;
      startPlayback(audio);
    }
  },

  playNext: (song) => {
    const s = get();
    if (!s.currentTrack || s.queue.length === 0 || s.currentQueueIndex < 0) {
      s.playContext([song], 0);
      return;
    }
    const queue = s.queue.slice();
    let cursor = s.currentQueueIndex;
    const existing = queue.findIndex((t) => t.id === song.id);
    if (existing >= 0) {
      queue.splice(existing, 1);
      if (existing < cursor) cursor -= 1;
      if (existing === cursor) {
        // was current — re-insert next but keep current pointer valid
      }
    }
    queue.splice(cursor + 1, 0, song);
    set({ queue, currentQueueIndex: cursor, nextTrackData: null });
  },

  togglePlay: () => {
    if (!get().currentTrack) return;
    if (isNative()) {
      void nativeTogglePlay();
      return;
    }
    const audio = get().audioNode;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  },

  next: () => {
    const s = get();
    if (!isNative() && !s.audioNode) return;

    // Repeat one: restart current track
    if (s.isRepeatMode === 2 && s.currentTrack) {
      restartCurrentTrack();
      return;
    }

    const queue = s.queue;
    if (queue.length === 0) {
      if (s.currentTrack) {
        pauseOutput(true);
        set({ isPlaying: false });
      }
      return;
    }

    // Re-locate the current index by track id in case state drifted
    let cursor = s.currentQueueIndex;
    if (
      s.currentTrack &&
      (cursor < 0 ||
        cursor >= queue.length ||
        queue[cursor]?.id !== s.currentTrack.id)
    ) {
      const found = queue.findIndex((t) => t.id === s.currentTrack!.id);
      cursor = found >= 0 ? found : -1;
    }

    let nextIndex: number;
    if (s.isShuffleActive && queue.length > 1) {
      do {
        nextIndex = Math.floor(Math.random() * queue.length);
      } while (nextIndex === cursor);
    } else {
      nextIndex = cursor + 1;
    }

    if (nextIndex >= queue.length) {
      if (s.isRepeatMode === 1) {
        nextIndex = 0;
      } else if (s.isAutoPlayEnabled && s.playSource === "search") {
        // Song radio: top the queue up with similar tracks and keep going.
        void topUpRadio();
        return;
      } else {
        pauseOutput(false, true);
        set({ isPlaying: false });
        return;
      }
    }
    s.playContext(queue, nextIndex);
  },

  prev: () => {
    const s = get();
    const audio = s.audioNode;
    const native = isNative();
    if (!native && !audio) return;
    const elapsedSec = native ? nativePositionSec : audio!.currentTime;
    if (elapsedSec > 3) {
      rewindCurrent();
      return;
    }
    let idx = s.currentQueueIndex - 1;
    if (idx < 0) {
      if (s.historyStack.length === 0) {
        rewindCurrent();
        return;
      }
      idx = 0;
    }
    s.playContext(s.queue, idx);
  },

  seekPercent: (pct) => {
    if (isNative()) {
      void nativeSeekPercent(pct);
      return;
    }
    const audio = get().audioNode;
    if (!audio || !isFinite(audio.duration)) return;
    audio.currentTime = Math.max(0, Math.min(1, pct)) * audio.duration;
  },

  setVolume: (v) => {
    const vol = Math.max(0, Math.min(1, v));
    if (isNative()) {
      if (currentAssetId) {
        NativeAudio.setVolume({ assetId: currentAssetId, volume: vol }).catch(noop);
      }
    } else {
      const audio = get().audioNode;
      if (audio) audio.volume = vol;
    }
    set({ volume: vol, isMuted: vol === 0 });
    saveSettings({
      volume: vol,
      speed: get().playbackRate,
      autoplay: get().isAutoPlayEnabled,
    });
  },

  toggleMute: () => {
    const audio = get().audioNode;
    const native = isNative();
    if (!native && !audio) return;
    const muted = !get().isMuted;
    if (native) {
      if (currentAssetId) {
        NativeAudio.setVolume({
          assetId: currentAssetId,
          volume: muted ? 0 : get().volume,
        }).catch(noop);
      }
    } else if (audio) {
      audio.muted = muted;
    }
    set({ isMuted: muted });
  },

  toggleShuffle: () =>
    set({ isShuffleActive: !get().isShuffleActive, nextTrackData: null }),

  cycleRepeat: () =>
    set({
      isRepeatMode: ((get().isRepeatMode + 1) % 3) as RepeatMode,
      nextTrackData: null,
    }),

  clearNextTrack: () => set({ nextTrackData: null }),
}));

/* -------------------------------------------------------------------------- */
/*  Output helpers (HTML5 <audio> on web/Electron, NativeAudio on native)     */
/* -------------------------------------------------------------------------- */

/** Restart the current track from 0 and keep playing (repeat-one). */
function restartCurrentTrack() {
  if (isNative()) {
    void replayCurrentNative(0);
    return;
  }
  const audio = usePlayback.getState().audioNode;
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

/** Seek the current track back to 0 without changing play/pause state. */
function rewindCurrent() {
  if (isNative()) {
    const id = currentAssetId;
    if (!id) return;
    NativeAudio.setCurrentTime({ assetId: id, time: 0 })
      .then(() => {
        nativePositionSec = 0;
        usePlayback.setState({ currentTime: 0 });
      })
      // Asset may have been stopped/unloaded — start it over instead.
      .catch(() => void replayCurrentNative(0));
    return;
  }
  const audio = usePlayback.getState().audioNode;
  if (audio) audio.currentTime = 0;
}

/**
 * Pause output, optionally rewinding to the start. `release` is used when the
 * queue is finished: on native it fully stops playback, clears the notification
 * and stops the Android foreground service.
 */
function pauseOutput(rewind: boolean, release = false) {
  if (isNative()) {
    void (async () => {
      const id = currentAssetId;
      try {
        if (release) {
          await releaseNativeSession();
        } else if (id) {
          await NativeAudio.pause({ assetId: id });
          if (rewind) await NativeAudio.setCurrentTime({ assetId: id, time: 0 });
        }
      } catch {
        /* noop */
      }
    })();
    return;
  }
  const audio = usePlayback.getState().audioNode;
  if (!audio) return;
  if (rewind) audio.currentTime = 0;
  audio.pause();
}

function prefetchNode(): HTMLAudioElement | null {
  // The native player preloads its own assets, so the <audio> warm-up isn't used there.
  if (typeof document === "undefined" || isExtension() || isNative()) return null;
  return document.getElementById("prefetchAudio") as HTMLAudioElement | null;
}

/* -------------------------------------------------------------------------- */
/*  Native (Capacitor) audio: @capgo/capacitor-native-audio                   */
/* -------------------------------------------------------------------------- */

/**
 * The plugin does NOT create the Android foreground service that keeps audio
 * alive with the screen locked. This is a tiny local plugin (PlaybackService.java
 * + PlaybackServicePlugin.java, see android/ folder) that starts/stops one.
 */
interface PlaybackServicePlugin {
  start(): Promise<void>;
  stop(): Promise<void>;
}
const PlaybackService = registerPlugin<PlaybackServicePlugin>("PlaybackService");
const isAndroid = () => Capacitor.getPlatform() === "android";

let nativeInit: Promise<void> | null = null;
let fgServiceStarted = false;
/** Incremented for every native play(); lets async work detect it was superseded. */
let nativeToken = 0;
/** True while a play() call is in flight, so events from the old track are ignored. */
let nativeSwitching = false;
let endedHandledToken = -1;
/** Plugin asset id of the track that's current (id = String(track.id)). */
let currentAssetId: string | null = null;
/** Assets we've preloaded: the current track plus a prefetched next one. */
const loadedAssets = new Set<string>();
let nativePositionSec = 0;
let nativeDurationSec = 0;
let lastStoreTimeSec = -1;
let nativePrefetchTriggered = false;
let nativeStopped = false;

const INVALID_URL_STRINGS = new Set(["", "null", "undefined", "about:blank", "#"]);

/** Pull one absolute http(s) URL out of a string / array / {url|link|src} payload. */
function pickUrl(input: unknown, preferLast = false, depth = 0): string | null {
  if (input == null || depth > 3) return null;
  if (Array.isArray(input)) {
    const items = preferLast ? [...input].reverse() : input;
    for (const item of items) {
      const url = pickUrl(item, preferLast, depth + 1);
      if (url) return url;
    }
    return null;
  }
  if (typeof input === "object") {
    const o = input as Record<string, unknown>;
    return pickUrl(o.url ?? o.link ?? o.src, preferLast, depth + 1);
  }
  if (typeof input !== "string") return null;
  let s = input.trim();
  if (INVALID_URL_STRINGS.has(s.toLowerCase())) return null;
  if (s.startsWith("//")) s = `https:${s}`;
  return /^https?:\/\/[^\s/]+/i.test(s) ? s : null;
}

function cleanText(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.trim()) return fallback;
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

/** Best available artwork for the lock screen (prefers the largest image). */
function resolveArtworkUrl(track: JSSong): string | null {
  let url = pickUrl((track as unknown as { image?: unknown }).image, true);
  if (!url) {
    try {
      url = pickUrl(getThumbnail(track));
    } catch {
      url = null;
    }
  }
  // JioSaavn serves the same image at several sizes; the lock screen wants a big one.
  return url ? url.replace(/\b(50x50|150x150)\b/, "500x500") : null;
}

/** Metadata shown in the Android notification / lock screen media controls. */
function buildNotificationMetadata(track: JSSong) {
  const album = (track as unknown as { album?: { name?: unknown } }).album?.name;
  const artwork = resolveArtworkUrl(track);
  return {
    title: cleanText(track.name, "AudiFiya"),
    artist: cleanText(getArtistString(track), "Unknown artist"),
    album: cleanText(album, "AudiFiya"),
    ...(artwork ? { artworkUrl: artwork } : {}),
  };
}

/**
 * Initialise the plugin once: configure it and attach the event listeners.
 * Safe to call repeatedly; every native playback path awaits it first.
 */
function initNativeAudio(): Promise<void> {
  if (!isNative()) return Promise.resolve();
  if (!nativeInit) {
    nativeInit = (async () => {
      await NativeAudio.configure({
        backgroundPlayback: true, // Android: don't auto-pause when the app is backgrounded
        showNotification: true, // lock screen + notification controls
        focus: true, // request audio focus so other apps pause
        background: true,
      });

      // ~every 100 ms while playing: drives the progress bar and the 80% prefetch.
      await NativeAudio.addListener("currentTime", ({ assetId, currentTime }) => {
        if (assetId && assetId !== currentAssetId) return;
        onNativeTime(currentTime);
      });

      // Fires when a track plays to its end (also with the screen locked).
      await NativeAudio.addListener("complete", ({ assetId }) => {
        if (assetId !== currentAssetId) return;
        onNativeComplete();
      });

      // Keeps the UI in sync with lock screen / notification / headset buttons.
      await NativeAudio.addListener("playbackState", (e) => {
        if (e.assetId && e.assetId !== currentAssetId) return;
        if (typeof e.currentTime === "number") nativePositionSec = e.currentTime;
        if (typeof e.duration === "number" && e.duration > 0) {
          nativeDurationSec = e.duration;
          usePlayback.setState({ duration: e.duration });
        }
        if (e.state === "playing") {
          nativeStopped = false;
          usePlayback.setState({ isPlaying: true });
          return;
        }
        if (nativeSwitching) return; // old track winding down while a new one starts
        if (e.state === "paused") {
          usePlayback.setState({ isPlaying: false });
        } else if (e.state === "stopped") {
          if (e.reason === "complete") {
            onNativeComplete();
          } else {
            // e.g. the user pressed Stop in the notification
            nativeStopped = true;
            usePlayback.setState({ isPlaying: false });
          }
        }
      });
    })().catch(() => {
      nativeInit = null; // allow a retry on the next call
    });
  }
  return nativeInit;
}

/** Start the Android foreground service (must happen while the app is visible). */
async function startForegroundService() {
  if (!isAndroid() || fgServiceStarted) return;
  try {
    await PlaybackService.start();
    fgServiceStarted = true;
  } catch {
    /* Java plugin not installed yet — playback still works while the app is open */
  }
}

async function stopForegroundService() {
  if (!isAndroid() || !fgServiceStarted) return;
  fgServiceStarted = false;
  try {
    await PlaybackService.stop();
  } catch {
    /* noop */
  }
}

/** Stop playback entirely, clear the notification and release the service. */
async function releaseNativeSession() {
  const id = currentAssetId;
  nativeStopped = true;
  try {
    if (id) await NativeAudio.stop({ assetId: id });
  } catch {
    /* noop */
  }
  await stopForegroundService();
}

async function unloadNativeAsset(assetId: string) {
  loadedAssets.delete(assetId);
  try {
    await NativeAudio.unload({ assetId });
  } catch {
    /* noop */
  }
}

/** Preload a track (with lock-screen metadata). No-op if it's already loaded. */
async function preloadNativeAsset(track: JSSong, src: string): Promise<string> {
  const assetId = String(track.id);
  if (loadedAssets.has(assetId)) return assetId;
  const options = {
    assetId,
    assetPath: src,
    isUrl: true,
    notificationMetadata: buildNotificationMetadata(track),
  };
  try {
    await NativeAudio.preload(options);
  } catch {
    // Most likely a stale asset with the same id — clear it and try once more.
    await NativeAudio.unload({ assetId }).catch(noop);
    await NativeAudio.preload(options);
  }
  loadedAssets.add(assetId);
  return assetId;
}

/** Unload everything except the current track (frees memory/cache). */
function pruneNativeAssets() {
  for (const id of [...loadedAssets]) {
    if (id === currentAssetId) continue;
    void unloadNativeAsset(id);
  }
}

/** Warm the next track's asset so the transition is instant, even in the background. */
async function prefetchNativeAsset(song: JSSong, url: string) {
  try {
    await initNativeAudio();
    await preloadNativeAsset(song, url);
  } catch {
    /* best-effort: nativePlayTrack() will preload it if this failed */
  }
}

function applyNativeVolumeAndRate(assetId: string) {
  const s = usePlayback.getState();
  const vol = s.isMuted ? 0 : s.volume;
  if (vol !== 1) NativeAudio.setVolume({ assetId, volume: vol }).catch(noop);
  if (s.playbackRate !== 1) NativeAudio.setRate({ assetId, rate: s.playbackRate }).catch(noop);
}

async function loadNativeDuration(assetId: string, token: number) {
  for (let i = 0; i < 12; i++) {
    try {
      const { duration } = await NativeAudio.getDuration({ assetId });
      if (token !== nativeToken) return;
      if (duration > 0) {
        nativeDurationSec = duration;
        usePlayback.setState({ duration });
        return;
      }
    } catch {
      /* asset may still be loading */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (token !== nativeToken) return;
  }
}

/** Native equivalent of the <audio> timeupdate handler. */
function onNativeTime(timeSec: number) {
  nativePositionSec = timeSec;
  // The plugin emits ~10x/second; only push ~4 updates/second into React.
  if (Math.abs(timeSec - lastStoreTimeSec) >= 0.25) {
    lastStoreTimeSec = timeSec;
    usePlayback.setState({ currentTime: timeSec });
  }
  // Same rule as the web build: resolve the next track at ~80%.
  if (
    nativeDurationSec > 0 &&
    timeSec / nativeDurationSec >= 0.8 &&
    !nativePrefetchTriggered
  ) {
    nativePrefetchTriggered = true;
    void prepareNextTrack();
  }
}

/** Native equivalent of the <audio> `ended` handler. */
function onNativeComplete() {
  if (endedHandledToken === nativeToken) return; // already handled for this play()
  endedHandledToken = nativeToken;
  nativeStopped = true;
  const s = usePlayback.getState();
  if (s.isRepeatMode === 2) {
    void replayCurrentNative(0);
    return;
  }
  if (!consumeNextTrack()) s.next();
}

/**
 * Play a track natively: preload it with notification metadata, then play it.
 * Preloading is skipped when the asset was already prefetched.
 */
async function nativePlayTrack(track: JSSong, src: string, positionSec = 0, retry = true) {
  const token = ++nativeToken;
  const assetId = String(track.id);
  const prevAssetId = currentAssetId;

  currentAssetId = assetId;
  nativeSwitching = true;
  nativeStopped = false;
  nativePrefetchTriggered = false;
  nativePositionSec = positionSec;
  nativeDurationSec = 0;
  lastStoreTimeSec = -1;
  usePlayback.setState({ currentTime: positionSec, duration: 0 });

  try {
    await initNativeAudio();
    await startForegroundService();
    if (token !== nativeToken) return;

    // Never let two tracks overlap.
    if (prevAssetId) await NativeAudio.stop({ assetId: prevAssetId }).catch(noop);
    // Replaying the same track: reload it so it starts from a clean state.
    if (assetId === prevAssetId && loadedAssets.has(assetId)) {
      await unloadNativeAsset(assetId);
    }

    // 1) preload (with notificationMetadata)  2) play
    await preloadNativeAsset(track, src);
    if (token !== nativeToken) return;
    await NativeAudio.play({
      assetId,
      ...(positionSec > 0 ? { time: positionSec } : {}),
    });
    if (token !== nativeToken) return;

    usePlayback.setState({ isPlaying: true });
    applyNativeVolumeAndRate(assetId);
    void loadNativeDuration(assetId, token);
    pruneNativeAssets();
  } catch {
    if (token !== nativeToken) return;
    await unloadNativeAsset(assetId);
    if (retry) {
      // One silent retry, like the web path.
      setTimeout(() => {
        if (token === nativeToken) void nativePlayTrack(track, src, positionSec, false);
      }, 250);
      return;
    }
    usePlayback.setState({ isPlaying: false });
  } finally {
    setTimeout(() => {
      if (token === nativeToken) nativeSwitching = false;
    }, 400);
  }
}

/** Re-start the current track (repeat-one, or after the player was stopped). */
async function replayCurrentNative(positionSec = 0) {
  const track = usePlayback.getState().currentTrack;
  if (!track) return;
  const src = getStreamUrl(track) ?? (await resolveStreamUrl(track));
  if (!src) return;
  await nativePlayTrack(track, src, positionSec);
}

async function nativeTogglePlay() {
  const id = currentAssetId;
  try {
    if (!id || nativeStopped || !loadedAssets.has(id)) {
      // Nothing loaded, or the player was stopped (track ended / notification Stop).
      const nearEnd = nativeDurationSec > 0 && nativeDurationSec - nativePositionSec <= 3;
      await replayCurrentNative(nearEnd ? 0 : nativePositionSec);
      return;
    }
    const { isPlaying } = await NativeAudio.isPlaying({ assetId: id });
    if (isPlaying) {
      await NativeAudio.pause({ assetId: id });
      usePlayback.setState({ isPlaying: false });
    } else {
      await NativeAudio.resume({ assetId: id });
      usePlayback.setState({ isPlaying: true });
    }
  } catch {
    /* noop */
  }
}

async function nativeSeekPercent(pct: number) {
  const id = currentAssetId;
  if (!id) return;
  try {
    let duration = nativeDurationSec;
    if (duration <= 0) duration = (await NativeAudio.getDuration({ assetId: id })).duration || 0;
    if (duration <= 0) return;
    const time = Math.max(0, Math.min(1, pct)) * duration;
    await NativeAudio.setCurrentTime({ assetId: id, time });
    nativePositionSec = time;
    usePlayback.setState({ currentTime: time });
  } catch {
    /* noop */
  }
}

/* -------------------------------------------------------------------------- */
/*  Prefetch / radio / HTML5 playback                                         */
/* -------------------------------------------------------------------------- */

/** Resolve a playable stream URL for a song, refetching details if needed. */
async function resolveStreamUrl(song: JSSong): Promise<string | null> {
  const direct = getStreamUrl(song);
  if (direct) return direct;
  const full = await fetchSongById(song.id);
  return full ? getStreamUrl(full) : null;
}

let prepareInFlight = false;

/**
 * Called around 80% through the current track: resolves the next track's
 * stream URL ahead of time so the `ended` handler never touches the network
 * (mobile browsers throttle fetches while the screen is off).
 */
export async function prepareNextTrack() {
  if (prepareInFlight) return;
  const s = usePlayback.getState();
  if (s.nextTrackData) return;
  if (s.isRepeatMode === 2) return; // repeat-one never advances
  if (s.isShuffleActive) return; // target is chosen at transition time

  const queue = s.queue;
  let cursor = s.currentQueueIndex;
  if (s.currentTrack && queue[cursor]?.id !== s.currentTrack.id) {
    const found = queue.findIndex((t) => t.id === s.currentTrack!.id);
    cursor = found >= 0 ? found : cursor;
  }

  prepareInFlight = true;
  try {
    let workingQueue = queue;
    let index = cursor + 1;

    if (index >= workingQueue.length) {
      if (s.isRepeatMode === 1 && workingQueue.length > 0) {
        index = 0;
      } else if (s.isAutoPlayEnabled && s.playSource === "search" && s.currentTrack) {
        // Song radio: pull suggestions early instead of after the track ends.
        const recs = await fetchRecommendations(
          s.currentTrack.id,
          getArtistString(s.currentTrack),
        );
        const fresh = recs.filter(
          (t) =>
            t.id !== s.currentTrack!.id &&
            !workingQueue.some((q) => q.id === t.id),
        );
        if (fresh.length === 0) return;
        workingQueue = [...usePlayback.getState().queue, ...fresh];
        index = workingQueue.length - fresh.length;
        usePlayback.setState({ queue: workingQueue });
      } else {
        return;
      }
    }

    const song = workingQueue[index];
    if (!song) return;
    const url = await resolveStreamUrl(song);
    if (!url) return;

    // Only commit if the listener hasn't moved on in the meantime.
    const now = usePlayback.getState();
    if (now.currentTrack?.id !== s.currentTrack?.id || now.nextTrackData) return;
    usePlayback.setState({ nextTrackData: { song, url, index } });

    // Native: preload the next asset so the swap is instant (even with the screen locked).
    if (isNative()) {
      void prefetchNativeAsset(song, url);
      return;
    }

    // Web: warm the bytes so the swap is instant.
    const buf = prefetchNode();
    if (buf && buf.src !== url) {
      try {
        buf.src = url;
        buf.load();
      } catch {
        /* noop */
      }
    }
  } catch {
    /* prefetch is best-effort */
  } finally {
    prepareInFlight = false;
  }
}

/**
 * Synchronous memory-to-audio swap used when a track ends. Returns false when
 * nothing is buffered so callers can fall back to the regular next() path.
 */
export function consumeNextTrack(): boolean {
  const s = usePlayback.getState();
  const buffered = s.nextTrackData;
  const audio = s.audioNode;
  if (!buffered || (!audio && !isNative())) return false;
  if (s.isRepeatMode === 2) return false;
  if (s.queue[buffered.index]?.id !== buffered.song.id) {
    usePlayback.setState({ nextTrackData: null });
    return false;
  }
  usePlayback.setState({ nextTrackData: null });
  // No network work here — the URL is already resolved in memory.
  s.playContext(s.queue, buffered.index, undefined, buffered.url);
  const buf = prefetchNode();
  if (buf) {
    try {
      buf.removeAttribute("src");
      buf.load();
    } catch {
      /* noop */
    }
  }
  return true;
}

/**
 * Start HTML5 playback with an explicit success/failure path so a backgrounded
 * tab still advances to the next track (browsers can reject play() when hidden).
 * Web / Electron only — the native shell goes through nativePlayTrack().
 */
export function startPlayback(audio: HTMLAudioElement, retry = true) {
  audio
    .play()
    .then(() => {
      if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "playing";
      }
    })
    .catch(() => {
      if (retry) {
        // One silent retry on the next tick — often enough after a src swap.
        setTimeout(() => startPlayback(audio, false), 250);
        return;
      }
      usePlayback.setState({ isPlaying: false });
      if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "paused";
      }
    });
}

let radioInFlight = false;

/** Fetch tracks similar to the current one and continue playback with them. */
async function topUpRadio() {
  if (radioInFlight) return;
  const s = usePlayback.getState();
  const seed = s.currentTrack;
  if (!seed) return;
  radioInFlight = true;
  try {
    const recs = await fetchRecommendations(seed.id, getArtistString(seed));
    const fresh = recs.filter(
      (t) => t.id !== seed.id && !s.queue.some((q) => q.id === t.id),
    );
    if (fresh.length === 0) {
      pauseOutput(false, true);
      usePlayback.setState({ isPlaying: false });
      return;
    }
    const queue = [...usePlayback.getState().queue, ...fresh];
    usePlayback.getState().playContext(queue, queue.length - fresh.length);
  } catch {
    pauseOutput(false, true);
    usePlayback.setState({ isPlaying: false });
  } finally {
    radioInFlight = false;
  }
}

export function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Initialise the native plugin as soon as the module loads (no-op on web/Electron).
void initNativeAudio();