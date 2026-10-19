# Background Autoplay Resilience — Next-Track Pre-Fetch Buffer

Goal: when the phone is locked or the tab is backgrounded, the next song must start instantly. Today the app only works out what comes next at the moment a song ends — and mobile browsers block network calls at that moment, so playback stops.

## 1. Prepare the next song early

- Add a `nextTrackData` slot in the playback engine: the upcoming song plus its resolved 320kbps stream URL, and the queue position it belongs to.
- While a song plays, once it passes 80% of its length and nothing is buffered yet, quietly prepare the next song: take `queue[currentQueueIndex + 1]`, resolve its stream URL, and store it.
- If the queue has no next item and song-radio autoplay applies (search-sourced plays), fetch the radio suggestions at the 80% mark instead of after the song ends, append them to the queue, and buffer the first one.
- Also warm the audio data itself with a hidden second `<audio>` element set to `preload="auto"` on the buffered URL, so the bytes are already in cache at swap time.

## 2. Instant swap when the song ends

- On `ended` (and the existing near-end safety net), if a buffered next track exists and matches the queue, do no network work at all: set the audio source to the stored URL, call play, update the current track and queue index from the stored metadata, clear the buffer so the cycle repeats.
- If nothing is buffered (user skipped, radio fetch failed, buffer stale), fall back to today's `next()` path.
- Any manual action that changes what plays next — skip, shuffle toggle, queue reorder, Play Next, choosing a new song — invalidates the buffer so a stale URL is never used.

## 3. Lock screen stays in sync

- The moment the swapped-in track starts playing, update the lock-screen metadata (title, artist, album, artwork) and playback state, and the tab title, from the already-in-memory track data — no fetch involved.
- Keep the existing retry-on-blocked-play behaviour.

## Technical notes

- `src/lib/playback-engine.ts`: new state `nextTrackData: { song: JSSong; url: string; index: number } | null`; actions `prepareNextTrack()` (guarded by an in-flight flag, resolves via `getStreamUrl`, falls back to `fetchSongById` when the queue entry has no download URLs, and calls the existing `fetchRecommendations` top-up early when at the queue tail); `consumeNextTrack()` performing the synchronous src swap + `startPlayback`; `clearNextTrack()` called from `playContext`, `playNext`, `prev`, `toggleShuffle`, `cycleRepeat`.
- `playContext` keeps its current responsibilities (history push, source tracking) — the swap path reuses it in a no-fetch mode so recently-played and media-session updates still happen.
- `src/components/PlayerBar.tsx`: the `timeupdate` handler adds the `>0.8` progress trigger; `onEnded` and the near-end guard call `consumeNextTrack()` first, `next()` only as fallback.
- Hidden prefetch element: a second `<audio id="prefetchAudio" preload="auto">` in `src/routes/__root.tsx`, muted, never played; buffering only.
- Repeat-one keeps restarting the same track and skips prefetching entirely.
