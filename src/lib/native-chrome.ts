import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

/**
 * Native (Capacitor) only: keeps the system status-bar icons readable.
 * `Style.Dark` = light icons for dark backgrounds, `Style.Light` = dark icons for light ones.
 * No-op on web and Electron.
 */
export async function setNativeStatusBarStyle(lightTheme: boolean) {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setStyle({ style: lightTheme ? Style.Light : Style.Dark });
  } catch {
    /* plugin not installed / not supported on this platform */
  }
}
