# Visualizer polish, search fixes, and artist search

## 1. Denser, smoother soundwave bar
Rebuild `WaveProgress` with ~72 thin bars (2px wide, 2px gap) instead of 18 chunky ones. Each bar animates height 4px -> 100% -> 4px with `ease-in-out ... infinite alternate` and a pseudo-random negative animation delay so the wave ripples instead of pulsing in unison. Paused state freezes the bars flat; the played portion still fills left-to-right via the existing clip-path overlay. Reduced-motion users keep the static bar.

## 2. Search history only on explicit submit
Today a debounced timer writes the typed text to history, so partial words pile up. Remove that effect entirely. History is written only when the user presses Enter (form submit) or clicks the search icon button. Typing still runs the live results query — only the saved history changes.

## 3. Recently played = search discoveries only
Add an optional play-source argument to the playback engine's `playContext` (defaults to no history write). Only the search page's result cards, voice search, and recently-played replays pass `"search"`. Liked Songs, playlists, the artist overlay, and auto-advance to the next queue track will no longer append to `spotify_playback_history`.

## 4. Artist search mode
Under the search field, add two toggle pills: **Songs** (default) and **Artists**. With Artists active, the query hits the artists search endpoint and results render as circular avatar cards with the artist name. Clicking a card opens the existing artist profile overlay by id, which already loads their top songs. Recent searches and recently played sections behave the same in both modes.

## Technical notes
- `src/components/WaveProgress.tsx`: bar count/geometry; `src/styles.css`: update the `wave-bounce` keyframes to the 4px/100% form and `alternate` direction.
- `src/lib/jiosaavn.ts`: add `searchArtists(query)` returning `{ id, name, imageUrl }[]` from `/api/search/artists`, with the same defensive parsing as existing helpers.
- `src/lib/playback-engine.ts`: `playContext(queue, index, source?: "search")` — gate `pushPlaybackHistory` on that flag; internal `next`/`prev` calls preserve the original source of the queue.
- `src/routes/search.tsx`: drop the history-saving effect, add submit/click triggers, add the mode pills and artist grid; `SongCard` gains an optional source prop passed through to `playContext`.
