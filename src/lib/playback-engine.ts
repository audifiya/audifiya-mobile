import { isExtension } from "./extension-env";
import { create } from "zustand";
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
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
      PlaybackService.setRate({ rate: nextRate }).catch(noop);
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
    if (isNative()) {
      // Native shell: subscribe to the playback service's events (idempotent).
      void initNativeAudio();
    } else {
      // Web / Electron: mirror the <audio> element's time + duration into the store.
      syncWebAudioToStore(node);
    }
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
    if (isNative()) {
      // The service plays from a native queue; it resolves a missing URL itself.
      void nativeStartContext(track, index, src);
      return;
    }
    if (!src) return;
    if (audio) {
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
    // Native: the queued-ahead tracks were planned from the old order; re-plan them.
    if (isNative()) void resetNativeUpcoming();
  },

  togglePlay: () => {
    if (!get().currentTrack) return;
    if (isNative()) {
      nativeTogglePlay();
      return;
    }
    const audio = get().audioNode;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  },

  next: () => {
    if (isNative()) {
      void nativeNext();
      return;
    }
    const s = get();
    const audio = s.audioNode;
    if (!audio) return;

    // Repeat one: restart current track
    if (s.isRepeatMode === 2 && s.currentTrack) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }

    const queue = s.queue;
    if (queue.length === 0) {
      if (s.currentTrack) {
        audio.currentTime = 0;
        audio.pause();
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
        audio.pause();
        set({ isPlaying: false });
        return;
      }
    }
    s.playContext(queue, nextIndex);
  },

  prev: () => {
    if (isNative()) {
      nativePrev();
      return;
    }
    const s = get();
    const audio = s.audioNode;
    if (!audio) return;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    let idx = s.currentQueueIndex - 1;
    if (idx < 0) {
      if (s.historyStack.length === 0) {
        audio.currentTime = 0;
        return;
      }
      idx = 0;
    }
    s.playContext(s.queue, idx);
  },

  seekPercent: (pct) => {
    if (isNative()) {
      const s = get();
      const duration = nativeDurationSec > 0 ? nativeDurationSec : s.duration;
      if (duration <= 0) return;
      const seconds = Math.max(0, Math.min(1, pct)) * duration;
      nativePositionSec = seconds;
      set({ currentTime: seconds });
      PlaybackService.seekTo({ positionMs: Math.round(seconds * 1000) }).catch(noop);
      return;
    }
    const audio = get().audioNode;
    if (!audio || !isFinite(audio.duration)) return;
    audio.currentTime = Math.max(0, Math.min(1, pct)) * audio.duration;
  },

  setVolume: (v) => {
    const vol = Math.max(0, Math.min(1, v));
    if (isNative()) {
      PlaybackService.setVolume({ volume: vol }).catch(noop);
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
      PlaybackService.setVolume({ volume: muted ? 0 : get().volume }).catch(noop);
    } else if (audio) {
      audio.muted = muted;
    }
    set({ isMuted: muted });
  },

  toggleShuffle: () => {
    set({ isShuffleActive: !get().isShuffleActive, nextTrackData: null });
    if (isNative()) void resetNativeUpcoming();
  },

  cycleRepeat: () => {
    const mode = ((get().isRepeatMode + 1) % 3) as RepeatMode;
    set({ isRepeatMode: mode, nextTrackData: null });
    if (isNative()) {
      PlaybackService.setRepeatMode({ mode: mode === 2 ? "one" : "off" }).catch(noop);
      void resetNativeUpcoming();
    }
  },

  clearNextTrack: () => set({ nextTrackData: null }),
}));

/* -------------------------------------------------------------------------- */
/*  Web / Electron: mirror <audio> time + duration into the store             */
/* -------------------------------------------------------------------------- */

/**
 * Keeps the store's `currentTime` and `duration` in sync with the HTML5 <audio>
 * element, so UI (mini player, notch, expanded player, lyrics) reads them from
 * usePlayback instead of attaching DOM listeners. The native build does the same
 * from the playback service's `position` events.
 */
let detachWebSync: (() => void) | null = null;

function syncWebAudioToStore(node: HTMLAudioElement) {
  detachWebSync?.();

  const syncTime = () => usePlayback.setState({ currentTime: node.currentTime || 0 });
  const syncDuration = () => {
    const d = node.duration;
    usePlayback.setState({ duration: Number.isFinite(d) ? d : 0 });
  };
  const reset = () => usePlayback.setState({ currentTime: 0, duration: 0 });

  node.addEventListener("timeupdate", syncTime);
  node.addEventListener("seeked", syncTime);
  node.addEventListener("loadedmetadata", syncDuration);
  node.addEventListener("durationchange", syncDuration);
  node.addEventListener("emptied", reset);
  syncTime();
  syncDuration();

  detachWebSync = () => {
    node.removeEventListener("timeupdate", syncTime);
    node.removeEventListener("seeked", syncTime);
    node.removeEventListener("loadedmetadata", syncDuration);
    node.removeEventListener("durationchange", syncDuration);
    node.removeEventListener("emptied", reset);
  };
}

function prefetchNode(): HTMLAudioElement | null {
  if (typeof document === "undefined" || isExtension() || isNative()) return null;
  return document.getElementById("prefetchAudio") as HTMLAudioElement | null;
}

/* -------------------------------------------------------------------------- */
/*  Native (Capacitor Android): PlaybackService with a native queue           */
/* -------------------------------------------------------------------------- */

/**
 * The Java PlaybackService owns the ExoPlayer, the MediaSession and the one
 * notification. We hand it a queue of resolved stream URLs, so it advances from
 * track to track on its own, even while the WebView is throttled with the screen off.
 * JavaScript only keeps the queue topped up and mirrors state into the store.
 */
interface NativeTrack {
  id: string;
  url: string;
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
}

interface NativeEvents {
  stateChanged: { isPlaying: boolean; state: string; index: number };
  trackChanged: { index: number; id: string; reason: string };
  position: { positionMs: number; durationMs: number; index: number };
  ended: Record<string, never>;
  error: { message: string; code?: string };
  stopped: Record<string, never>;
}

interface PlaybackServicePlugin {
  startService(o: { title?: string; artist?: string }): Promise<void>;
  stopService(): Promise<void>;
  setQueue(o: {
    tracks: NativeTrack[];
    startIndex?: number;
    positionMs?: number;
    autoPlay?: boolean;
  }): Promise<void>;
  addTracks(o: { tracks: NativeTrack[] }): Promise<void>;
  removeUpcoming(): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  seekTo(o: { positionMs: number }): Promise<void>;
  setVolume(o: { volume: number }): Promise<void>;
  setRate(o: { rate: number }): Promise<void>;
  setRepeatMode(o: { mode: "off" | "one" }): Promise<void>;
  requestNotificationPermission(): Promise<{ granted: boolean }>;
  addListener<K extends keyof NativeEvents>(
    eventName: K,
    listener: (event: NativeEvents[K]) => void,
  ): Promise<PluginListenerHandle>;
}

const PlaybackService = registerPlugin<PlaybackServicePlugin>("PlaybackService");

/** How many tracks to keep queued natively ahead of the current one. */
const NATIVE_LOOKAHEAD = 10;

let nativeInit: Promise<void> | null = null;
/** Bumped whenever a new native queue is started (supersedes in-flight starts). */
let nativeSession = 0;
/** Bumped whenever the upcoming part of the native queue is invalidated (supersedes top-ups). */
let nativeEpoch = 0;
/** The service is running with a queue. */
let nativeActive = false;
/** JS-queue index of every item in the native queue (same order as the native queue). */
let nativePlan: number[] = [];
/** Position of the current item in the native queue. */
let nativeIndex = 0;
let nativeTopUpBusy = false;
let nativeTopUpQueued = false;
let nativePositionSec = 0;
let nativeDurationSec = 0;
let notificationPermissionAsked = false;

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

function toNativeTrack(track: JSSong, url: string): NativeTrack {
  const album = (track as unknown as { album?: { name?: unknown } }).album?.name;
  const artwork = resolveArtworkUrl(track);
  return {
    id: String(track.id),
    url,
    title: cleanText(track.name, "AudiFiya"),
    artist: cleanText(getArtistString(track), "Unknown artist"),
    album: cleanText(album, "AudiFiya"),
    ...(artwork ? { artworkUrl: artwork } : {}),
  };
}

/** Subscribe to the service's events once. */
function initNativeAudio(): Promise<void> {
  if (!isNative()) return Promise.resolve();
  if (!nativeInit) {
    nativeInit = (async () => {
      await PlaybackService.addListener("stateChanged", (e) => {
        usePlayback.setState({ isPlaying: e.isPlaying });
      });
      await PlaybackService.addListener("position", (e) => {
        nativePositionSec = e.positionMs / 1000;
        nativeDurationSec = e.durationMs > 0 ? e.durationMs / 1000 : 0;
        usePlayback.setState({ currentTime: nativePositionSec, duration: nativeDurationSec });
      });
      await PlaybackService.addListener("trackChanged", onNativeTrackChanged);
      await PlaybackService.addListener("ended", () => void onNativeEnded());
      await PlaybackService.addListener("stopped", () => {
        // Notification dismissed / stopped from outside: the native queue is gone.
        nativeActive = false;
        nativePlan = [];
        nativeIndex = 0;
        usePlayback.setState({ isPlaying: false });
      });
    })().catch(() => {
      nativeInit = null; // allow a retry on the next call
    });
  }
  return nativeInit;
}

/** Which JS-queue index does native item `index` (with track id `id`) correspond to? */
function jsIndexForNative(index: number, id: string): number {
  const queue = usePlayback.getState().queue;
  const planned = nativePlan[index];
  if (planned !== undefined && String(queue[planned]?.id) === id) return planned;
  return queue.findIndex((t) => String(t.id) === id);
}

/** The service moved to another item (auto-advance, notification/lock-screen skip, ...). */
function onNativeTrackChanged(e: { index: number; id: string }) {
  nativeIndex = e.index;
  const jsIndex = jsIndexForNative(e.index, e.id);
  const s = usePlayback.getState();
  const track = jsIndex >= 0 ? s.queue[jsIndex] : undefined;
  if (!track) return;

  nativePositionSec = 0;
  nativeDurationSec = 0;
  if (jsIndex !== s.currentQueueIndex || track.id !== s.currentTrack?.id) {
    const prev = s.currentTrack;
    usePlayback.setState({
      currentQueueIndex: jsIndex,
      currentTrack: track,
      currentTime: 0,
      duration: 0,
      nextTrackData: null,
      historyStack: prev ? [...s.historyStack, prev].slice(-50) : s.historyStack,
    });
    if (s.playSource === "search") {
      try { pushPlaybackHistory(track); } catch { /* noop */ }
    }
  }
  void topUpNativeQueue();
}

/** The native queue ran dry (JS was too slow, or the context really ended). */
async function onNativeEnded() {
  const added = await topUpNativeQueue(); // the service continues into new tracks by itself
  if (added === 0) usePlayback.setState({ isPlaying: false });
}

/** JS-queue indexes that should follow the last planned item, honouring shuffle / repeat-all. */
function planUpcoming(count: number): number[] {
  const s = usePlayback.getState();
  const queue = s.queue;
  if (queue.length === 0) return [];
  const out: number[] = [];
  let last = nativePlan.length ? nativePlan[nativePlan.length - 1] : s.currentQueueIndex;
  for (let n = 0; n < count; n++) {
    let next: number;
    if (s.isShuffleActive && queue.length > 1) {
      do {
        next = Math.floor(Math.random() * queue.length);
      } while (next === last);
    } else {
      next = last + 1;
      if (next >= queue.length) {
        if (s.isRepeatMode === 1) next = 0;
        else break;
      }
    }
    out.push(next);
    last = next;
  }
  return out;
}

/** Song radio: append similar tracks to the JS queue. Returns how many were added. */
async function appendRecommendations(): Promise<number> {
  const seed = usePlayback.getState().currentTrack;
  if (!seed) return 0;
  try {
    const recs = await fetchRecommendations(seed.id, getArtistString(seed));
    const queue = usePlayback.getState().queue;
    const fresh = recs.filter((t) => t.id !== seed.id && !queue.some((q) => q.id === t.id));
    if (fresh.length === 0) return 0;
    usePlayback.setState({ queue: [...usePlayback.getState().queue, ...fresh] });
    return fresh.length;
  } catch {
    return 0;
  }
}

/**
 * Keep NATIVE_LOOKAHEAD tracks queued after the current one. Resolves their stream URLs
 * and appends them to the native queue. Returns how many tracks were added.
 */
async function topUpNativeQueue(): Promise<number> {
  if (!isNative() || !nativeActive) return 0;
  if (nativeTopUpBusy) {
    nativeTopUpQueued = true;
    return 0;
  }
  nativeTopUpBusy = true;
  const epoch = nativeEpoch;
  let added = 0;
  try {
    for (let round = 0; round < 2; round++) {
      const s = usePlayback.getState();
      const need = NATIVE_LOOKAHEAD - (nativePlan.length - 1 - nativeIndex);
      if (need <= 0) break;

      const indexes = planUpcoming(need);
      if (indexes.length === 0) {
        // End of the queue: song radio keeps going with similar tracks (same rule as the web build).
        if (
          round === 0 &&
          s.isAutoPlayEnabled &&
          s.playSource === "search" &&
          s.isRepeatMode !== 1 &&
          (await appendRecommendations()) > 0
        ) {
          if (epoch !== nativeEpoch) break;
          continue;
        }
        break;
      }

      const resolved = await Promise.all(
        indexes.map(async (index) => {
          const song = usePlayback.getState().queue[index];
          if (!song) return null;
          const url = await resolveStreamUrl(song).catch(() => null);
          return url ? { index, track: toNativeTrack(song, url) } : null;
        }),
      );
      if (epoch !== nativeEpoch) break;

      const ok = resolved.filter((r): r is { index: number; track: NativeTrack } => r !== null);
      if (ok.length === 0) break;
      await PlaybackService.addTracks({ tracks: ok.map((r) => r.track) });
      if (epoch !== nativeEpoch) break;
      nativePlan.push(...ok.map((r) => r.index));
      added += ok.length;
    }
  } catch {
    /* best-effort: the next track change tries again */
  } finally {
    nativeTopUpBusy = false;
    if (nativeTopUpQueued) {
      nativeTopUpQueued = false;
      void topUpNativeQueue();
    }
  }
  return added;
}

/** The order of upcoming tracks changed (play next / shuffle / repeat): re-plan them. */
async function resetNativeUpcoming() {
  if (!nativeActive) return;
  nativeEpoch++;
  nativePlan = nativePlan.slice(0, nativeIndex + 1);
  if (nativePlan.length) nativePlan[nativeIndex] = usePlayback.getState().currentQueueIndex;
  try {
    await PlaybackService.removeUpcoming();
  } catch {
    /* noop */
  }
  void topUpNativeQueue();
}

/**
 * Start playing a track from the JS queue: start the foreground service (notification
 * appears immediately), send the first track, then queue the next ones behind it.
 */
async function nativeStartContext(track: JSSong, index: number, presetUrl?: string | null) {
  const session = ++nativeSession;
  nativeEpoch++;
  nativeActive = true;
  nativePlan = [index];
  nativeIndex = 0;
  nativePositionSec = 0;
  nativeDurationSec = 0;
  usePlayback.setState({ currentTime: 0, duration: 0 });

  const first = toNativeTrack(track, "");
  try {
    await initNativeAudio();

    // Android 13+: the notification is hidden unless the user allows it. Ask once.
    if (!notificationPermissionAsked) {
      notificationPermissionAsked = true;
      await PlaybackService.requestNotificationPermission().catch(noop);
    }
    if (session !== nativeSession) return;

    // Shows the notification right away (Android requires it within ~5 s of starting the service).
    await PlaybackService.startService({ title: first.title, artist: first.artist });
    const url = presetUrl ?? getStreamUrl(track) ?? (await resolveStreamUrl(track));
    if (session !== nativeSession) return;
    if (!url) {
      usePlayback.setState({ isPlaying: false });
      return;
    }

    await PlaybackService.setQueue({
      tracks: [{ ...first, url }],
      startIndex: 0,
      autoPlay: true,
    });
    if (session !== nativeSession) return;

    const s = usePlayback.getState();
    PlaybackService.setVolume({ volume: s.isMuted ? 0 : s.volume }).catch(noop);
    PlaybackService.setRate({ rate: s.playbackRate }).catch(noop);
    PlaybackService.setRepeatMode({ mode: s.isRepeatMode === 2 ? "one" : "off" }).catch(noop);
    usePlayback.setState({ isPlaying: true });

    void topUpNativeQueue();
  } catch {
    if (session === nativeSession) usePlayback.setState({ isPlaying: false });
  }
}

function nativeTogglePlay() {
  const s = usePlayback.getState();
  if (!nativeActive) {
    // Service is gone (e.g. its notification was dismissed): start the current track again.
    if (s.currentTrack) {
      void nativeStartContext(s.currentTrack, Math.max(0, s.currentQueueIndex));
    }
    return;
  }
  (s.isPlaying ? PlaybackService.pause() : PlaybackService.play()).catch(noop);
}

async function nativeNext() {
  const s = usePlayback.getState();
  if (!nativeActive) return;

  // Repeat one: restart the current track
  if (s.isRepeatMode === 2 && s.currentTrack) {
    PlaybackService.seekTo({ positionMs: 0 }).catch(noop);
    PlaybackService.play().catch(noop);
    return;
  }

  if (nativeIndex < nativePlan.length - 1) {
    PlaybackService.next().catch(noop);
    return;
  }

  // Nothing queued ahead: try to extend (repeat-all wrap / song radio).
  const added = await topUpNativeQueue();
  if (added > 0) {
    PlaybackService.next().catch(noop);
  } else {
    PlaybackService.pause().catch(noop);
    usePlayback.setState({ isPlaying: false });
  }
}

function nativePrev() {
  const s = usePlayback.getState();
  if (!nativeActive) return;

  if (nativePositionSec > 3) {
    rewindNative();
    return;
  }
  // The service still has the previous item: go back natively.
  if (nativeIndex > 0) {
    PlaybackService.previous().catch(noop);
    return;
  }
  // First item of the native window: rebuild from the JS queue (same as the web build).
  let idx = s.currentQueueIndex - 1;
  if (idx < 0) {
    if (s.historyStack.length === 0) {
      rewindNative();
      return;
    }
    idx = 0;
  }
  s.playContext(s.queue, idx);
}

function rewindNative() {
  nativePositionSec = 0;
  usePlayback.setState({ currentTime: 0 });
  PlaybackService.seekTo({ positionMs: 0 }).catch(noop);
}

/* -------------------------------------------------------------------------- */
/*  Prefetch / radio / HTML5 playback (web + Electron)                        */
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
 * Web / Electron only: the native build keeps a queue ahead instead.
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

    // Warm the bytes so the swap is instant.
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
  if (!buffered || !audio) return false;
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
 * Web / Electron only — the native shell plays through PlaybackService.
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

/** Fetch tracks similar to the current one and continue playback with them (web / Electron). */
async function topUpRadio() {
  if (radioInFlight) return;
  const s = usePlayback.getState();
  const seed = s.currentTrack;
  const audio = s.audioNode;
  if (!seed) return;
  radioInFlight = true;
  try {
    const recs = await fetchRecommendations(seed.id, getArtistString(seed));
    const fresh = recs.filter(
      (t) => t.id !== seed.id && !s.queue.some((q) => q.id === t.id),
    );
    if (fresh.length === 0) {
      audio?.pause();
      usePlayback.setState({ isPlaying: false });
      return;
    }
    const queue = [...usePlayback.getState().queue, ...fresh];
    usePlayback.getState().playContext(queue, queue.length - fresh.length);
  } catch {
    audio?.pause();
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

// Subscribe to the playback service's events as soon as the module loads (no-op on web/Electron).
void initNativeAudio();
