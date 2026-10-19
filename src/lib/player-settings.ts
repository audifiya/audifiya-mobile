const KEY = "spotify_settings";

export interface PlayerSettings {
  volume: number;
  speed: number;
  autoplay?: boolean;
}

export function loadSettings(): PlayerSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlayerSettings>;
    const volume =
      typeof parsed.volume === "number" && isFinite(parsed.volume)
        ? Math.max(0, Math.min(1, parsed.volume))
        : 0.8;
    const speed =
      typeof parsed.speed === "number" && parsed.speed > 0 ? parsed.speed : 1;
    const autoplay = parsed.autoplay !== false;
    return { volume, speed, autoplay };
  } catch {
    return null;
  }
}

export function saveSettings(s: PlayerSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* noop */
  }
}
