# AudiFiya as Web App + Chrome Extension (side panel)

## Goal
Same codebase runs as the normal website (unchanged) and as an installable Manifest V3 Chrome extension that opens AudiFiya in Chrome's side panel, with music that keeps playing after the panel is closed.

## Important constraint
The website is server-rendered and has no static `index.html`. Chrome extensions only load files packaged inside them, so the extension needs a separate static build of the app. The website build stays exactly as it is.

## What gets built

1. **Extension files** (in an `extension/` folder, copied into the package)
   - `manifest.json`: MV3, permissions `sidePanel`, `offscreen`, `storage`; `side_panel.default_path` = `index.html`; `background.service_worker` = `background.js`; clicking the toolbar icon opens the side panel; host permissions for the music and lyrics services.
   - `background.js`: opens the side panel on icon click, creates the offscreen document (`audio.html`, reason `AUDIO_PLAYBACK`) on demand, and relays messages between panel and offscreen audio.
   - `audio.html` + `audio.js`: holds the real `<audio>` element; handles play / pause / seek / volume / speed / load, and reports time, duration, ended and play state back.

2. **Environment-aware audio**
   - New helper `isExtension()` using exactly `typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id`. All Chrome calls go behind it.
   - **Web mode (default):** current `<audio>` path, untouched.
   - **Extension mode:** a small "remote audio" adapter that looks like the audio element to the player (play, pause, src, currentTime, volume, playbackRate, events) but sends messages to `background.js`. The player, progress bar, lyrics sync, prefetch and autoplay keep working because they talk to the same interface.
   - Media Session controls stay on the web side; in extension mode the offscreen page sets them so keyboard media keys still work.

3. **Static extension build**
   - Extra build script producing a client-only (SPA) build into `dist-extension/`, with `index.html` at the root, plus the extension files and icons.
   - Download button for the zipped extension and install steps (unzip, `chrome://extensions`, Developer mode, Load unpacked) shown on the Library page.

## Known limitations
- Admin panel, feedback, sharing links and accounts work only if the backend allows requests from the extension origin; they will be tested but may need follow-up.
- Shared playlist links (`?playlist=`) open on the website, not in the panel.
- Liquid-glass refraction filter is Chromium-only anyway, so it works in the panel.

## Technical details
- `src/lib/extension-env.ts`: `isExtension()`.
- `src/lib/remote-audio.ts`: EventTarget-based shim implementing the subset of `HTMLAudioElement` used by `playback-engine.ts`, `PlayerBar`, `media-session.ts`, `WaveProgress`, `LyricsPane`. Message protocol: `{target:'offscreen', cmd, payload}` and state events `{target:'panel', type:'timeupdate'|'ended'|'play'|'pause'|'loadedmetadata'|'error', ...}`.
- `attachAudio` receives the shim instead of `#nativeAudio` when `isExtension()`; prefetch buffer element skipped in extension mode (offscreen preloads instead).
- Background: `chrome.offscreen.hasDocument()` guard before `createDocument`; `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`.
- SPA build via a second Vite config (TanStack Start SPA mode / prerender shell to `index.html`), relative asset base, no inline scripts (MV3 CSP).
- Zip produced into `public/audifiya-extension.zip`, downloaded via fetch+blob.
- Record the dual-target rule in `AGENTS.md`.
