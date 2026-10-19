import { useEffect, useState } from "react";

export type LayoutPreference = "grid" | "list";

const KEY = "spotify_layout_pref";
const EVENT = "app-layout-pref-changed";

export function readLayoutPref(): LayoutPreference {
  if (typeof window === "undefined") return "grid";
  try {
    return window.localStorage.getItem(KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

export function setLayoutPref(value: LayoutPreference) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    /* noop */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function useLayoutPref(): [LayoutPreference, (v: LayoutPreference) => void] {
  const [pref, setPref] = useState<LayoutPreference>("grid");
  useEffect(() => {
    const sync = () => setPref(readLayoutPref());
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return [pref, setLayoutPref];
}
