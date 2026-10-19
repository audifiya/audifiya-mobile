# Liquid Light Mode, Smarter Home Feed, Background Autoplay & Lock-Screen Controls

## 1. Three-way theme engine

The theme now cycles: Standard → Liquid Dark → Liquid Light.

- Stored value becomes `standard` | `liquid-dark` | `liquid-light` (old `liquid` and the legacy glass key both map to `liquid-dark`).
- The pill toggle becomes a 3-stop control: tapping it advances to the next look, with the thumb sliding between three positions and swapping icon (grid / droplet / sun).
- Liquid Light surfaces: bottom nav, mini player, search field and chips use `bg-white/60 backdrop-blur-[40px] saturate-[200%] border-black/5` with a soft light shadow; the active tab capsule becomes `bg-black/10 text-black`.
- Page background and text flip with the mode: near-black for Standard/Liquid Dark, `#f5f5f7` with dark text for Liquid Light. Cards, headers, sidebar, player bar and expanded player all read from the theme tokens so nothing stays white-on-white.

## 2. Home "Recommended for you" seeding

- If the listening history has entries, keep the current behaviour: seed recommendations from the most recently played track.
- If history is empty (new user), seed from the artists chosen during onboarding — fetch that artist's top songs instead of generic charts.
- Onboarding gets a third step: after name and languages, the user picks a few favourite artists (searched live from the music service). Choices are saved alongside the profile.
- If a new user skips artist selection, the current trending fallback still applies.

## 3. Background autoplay fix

- When a track ends, the next track is loaded and `play()` is called with an explicit success/failure path; on success the OS playback state is marked playing, on failure one silent retry is attempted before pausing.
- Track advance no longer depends on the tab being focused.

## 4. Tab title and lock-screen controls

- Browser tab title becomes "Song name - AudiFiya" while something is playing, back to "AudiFiya" when stopped.
- Phone lock screen / desktop media keys show the song title, artist, album and cover art, with working play, pause, previous and next buttons, plus seek position updates.

## Technical notes

- `src/lib/theme-mode.ts`: `ThemeMode = 'standard' | 'liquid-dark' | 'liquid-light'`, `cycleTheme()`, exposes `liquid` and `light` booleans; root classes `standard-theme`, `liquid-dark-theme`, `liquid-light-theme`.
- Components updated for the third branch: `ThemeToggle`, `MobileTabBar`, `MiniPlayer`, `AppShell`, `Sidebar`, `PlayerBar`, `routes/search.tsx`.
- `src/styles.css`: add a `html.liquid-light-theme` token block (light surfaces, dark text) next to the existing liquid block.
- `src/lib/user-profile.ts`: `UserProfile` gains `artists?: { id: string; name: string; image?: string }[]`; `OnboardingModal` gains the artist step using `searchArtists`.
- `src/routes/index.tsx`: recommendation query key/seed switches on history length; artist seed uses `fetchArtistSongs`.
- `src/lib/playback-engine.ts`: shared `startPlayback()` helper wrapping `play()` with retry + `navigator.mediaSession.playbackState`.
- New `src/lib/media-session.ts` (or an effect in `__root.tsx`) sets `MediaMetadata`, action handlers for play/pause/next/prev/seek, and `document.title`, guarded for SSR and unsupported browsers.
