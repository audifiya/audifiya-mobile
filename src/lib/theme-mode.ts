import { useEffect, useSyncExternalStore } from "react";

export type ThemeMode = "standard" | "liquid-dark" | "liquid-light";

const KEY = "audifiya_theme";
const LEGACY_KEY = "spotify_glass_mode";
const EVT = "app-theme-mode-changed";

export const THEME_ORDER: ThemeMode[] = [
  "standard",
  "liquid-dark",
  "liquid-light",
];

let mode: ThemeMode = "liquid-dark";

function emit() {
  window.dispatchEvent(new CustomEvent(EVT));
}

function apply(v: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("standard-theme", v === "standard");
  root.classList.toggle("liquid-dark-theme", v === "liquid-dark");
  root.classList.toggle("liquid-light-theme", v === "liquid-light");
}

function read(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (
      stored === "standard" ||
      stored === "liquid-dark" ||
      stored === "liquid-light"
    ) {
      return stored;
    }
    if (stored === "liquid") return "liquid-dark";
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy === "1") return "liquid-dark";
    if (legacy === "0") return "standard";
  } catch {
    /* noop */
  }
  return "liquid-dark";
}

export function setThemeMode(v: ThemeMode) {
  mode = v;
  try {
    window.localStorage.setItem(KEY, v);
  } catch {
    /* noop */
  }
  apply(v);
  emit();
}

function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  return () => window.removeEventListener(EVT, cb);
}

export function useThemeMode() {
  const value = useSyncExternalStore(
    subscribe,
    () => mode,
    () => "liquid-dark" as ThemeMode,
  );

  useEffect(() => {
    const stored = read();
    if (stored !== mode) {
      mode = stored;
      apply(stored);
      emit();
    } else {
      apply(mode);
    }
  }, []);

  return {
    mode: value,
    liquid: value !== "standard",
    light: value === "liquid-light",
    cycleTheme: () => {
      const idx = THEME_ORDER.indexOf(mode);
      setThemeMode(THEME_ORDER[(idx + 1) % THEME_ORDER.length]!);
    },
    setThemeMode,
  };
}
