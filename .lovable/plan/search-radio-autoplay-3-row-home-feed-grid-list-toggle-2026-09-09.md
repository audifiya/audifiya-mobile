# Search radio autoplay, 3-row home feed, grid/list toggle

## 1. Playing from search starts a "song radio"

Tapping a search result plays just that one song instead of queuing the whole result list. When it finishes, the app fetches songs similar to it and keeps playing without interruption.

- Search result cards call `playContext([song], 0, "search")`.
- New `fetchRecommendations(songId)` in `src/lib/jiosaavn.ts` hitting `/api/songs/{id}/recommendations`, with a fallback to a search on the song's primary artist name if the endpoint returns nothing.
- `playback-engine.next()`: when the queue has no further track and the current play source is search-originated, fetch recommendations for the current track, append them to the queue, and continue playing. If the fetch returns nothing, stop as it does today.
- An `isAutoPlayEnabled` flag (default on) lives in the playback store and is persisted with the existing player settings; a small toggle sits in the expanded player next to shuffle/repeat.

## 2. Home becomes a 3-row feed

Row 1 — Trending now: unchanged.

Row 2 — Recommended for you: takes the most recent entry from the saved play history, fetches recommendations for it, and renders the same horizontal scroller as Trending. With no history, falls back to the trending/top-charts fetch with a different language seed so it doesn't duplicate Row 1 exactly.

Row 3 — Recently played: reads the locally saved play history (already stored newest-first) and renders it in the same scroller, with a "Clear" action. Each card resolves a fresh playable stream by song id before playing, because the saved records intentionally store only artwork and title.

Each row hides itself when it has no items; skeletons show while loading.

## 3. Grid / list view toggle

- New `src/lib/layout-pref.ts`: `layoutPreference` ("grid" | "list") persisted to `localStorage` under `spotify_layout_pref`, exposed via a hook with a change event, matching the existing library-store pattern.
- A two-icon toggle (grid / list) sits at the right of the section headers on Search results, Liked Songs, and Library.
- Grid: `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4` with the current vertical `SongCard`.
- List: `flex flex-col gap-2 w-full` with a new compact row variant of `SongCard` — 48px artwork left, title/artist middle, duration plus the existing save/queue/more controls right. Same props, so playback, liked, playlist and "play next" behaviour is identical in both modes.
- Home's horizontal scrollers are unaffected by the toggle.

## Technical notes

- `src/lib/jiosaavn.ts`: add `fetchRecommendations(id)` and `fetchSongById(id)` with the same defensive parsing as existing helpers.
- `src/lib/playback-engine.ts`: `isAutoPlayEnabled`, `toggleAutoPlay`, async recommendation top-up inside `next()`; guard against re-entrant fetches with an internal in-flight flag.
- `src/components/SongCard.tsx`: add a `variant?: "grid" | "list"` prop; extract the shared menu so both variants use one implementation.
- Touched routes: `src/routes/index.tsx`, `src/routes/search.tsx`, `src/routes/liked.tsx`, `src/routes/library.tsx`.
