# Lyrics scroll fix, speed control, glass theme

## 1. Lyrics centering fix

The lyrics deck becomes a strict scroll box (`h-[40vh]` in the expanded player, full height on mobile) with a separate inner list carrying `pt-[20vh] pb-[20vh]`. That empty space lets the first and last lines physically reach the vertical center, so the active line stops getting stuck at the bottom. Auto-scroll still fires on every active-index change and keeps the 4-second grace period after a manual scroll.

## 2. Playback speed control

A small text button showing the current rate (`1x`, `1.5x`, …) appears in the bottom player bar next to the repeat/volume controls and in the expanded player near repeat. Tapping cycles 1.0 → 1.25 → 1.5 → 2.0 → 0.5 → 0.75 → 1.0. The rate is applied straight to the audio element and re-applied whenever a new track loads, so it persists across skips.

## 3. Glass mode toggle

A Sparkles icon button in the sticky top-right header toggles a global glass theme, remembered in local storage. When on:

- The page background becomes a colorful mesh gradient (green top-left, blue bottom-right, black base).
- Sidebar, workspace, player bar, mobile tab bar, and the full-screen player switch from solid `#000`/`#121212` to translucent surfaces with heavy backdrop blur and hairline white borders.
- Solid mode stays exactly as it is today.

## Technical notes

- `src/components/LyricsPane.tsx`: outer `div` gets `h-full overflow-y-auto no-scrollbar scroll-smooth relative w-full`; inner list wrapper gets `pt-[20vh] pb-[20vh]`; line ids stay `lyric-line-{i}` and the effect keeps using `scrollIntoView({ behavior: "smooth", block: "center" })`. Plain-lyrics branch unchanged.
- `src/lib/playback-engine.ts`: add `playbackRate: number` (default 1) and `cyclePlaybackRate()`; set `audio.playbackRate` on change and after `audio.src` assignment in `playContext`.
- New `src/components/SpeedButton.tsx`: renders `${rate}x`, brand-colored when not 1x; used in `PlayerBar.tsx` and `ExpandedPlayer.tsx`.
- New `src/lib/theme-mode.ts`: zustand store `useGlassMode` with `spotify_glass_mode` localStorage key, hydrated in an effect (SSR-safe) and toggling a `glass-theme` class on `document.documentElement`.
- `src/styles.css`: `html.glass-theme` block overriding `--base`, `--surface-main`, `--surface-card`, `--surface-card-hover` to `rgba(255,255,255,0.05)`-style values plus a `body` mesh-gradient background and a `@utility glass-surface` applying `backdrop-filter: blur(40px)` and `border: 1px solid rgba(255,255,255,0.1)`. Standard `backdrop-filter` only, no vendor prefixes.
- Glass class applied conditionally in `AppShell.tsx`, `Sidebar.tsx`, `PlayerBar.tsx`, `MobileTabBar.tsx`, `ExpandedPlayer.tsx`.
- Toggle button lives in `src/components/AppShell.tsx` header, left of the profile chip.
