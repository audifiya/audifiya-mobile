/* eslint-disable @typescript-eslint/no-explicit-any */
/** True only when running inside the AudiFiya Chrome extension (side panel). */
export function isExtension(): boolean {
  const c = (globalThis as any).chrome;
  return !!(typeof c !== "undefined" && c && c.runtime && c.runtime.id);
}

export function chromeApi(): any {
  return isExtension() ? (globalThis as any).chrome : null;
}
