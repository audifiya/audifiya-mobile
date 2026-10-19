# Reliable lyrics and search by lyrics

## Important finding about lrc.red
lrc.red is a lyrics website, not a public lyrics service. It offers no documented search or lyrics address that other apps can call. Its own page only talks to private internal addresses that can change or block outside apps at any time, so building on it would break without warning.

This plan uses services that are open and were confirmed to respond:
- **LRCLIB**: time-synced lyrics, plus full-text search across lyrics.
- **The music library AudiFiya already uses**: it has plain lyrics for many songs, often written in Hinglish (for example "Hum Tere Bin Ab Reh Nahi Sakte…").

## 1. Lyrics in the player (waterfall)
1. **Synced lyrics from LRCLIB**: an exact match on title, artist, album and length. If there isn't one, a looser title and artist search. Lines highlight and scroll with the song, as they do today.
2. **Plain lyrics from LRCLIB** if no synced version exists.
3. **The music library's own lyrics** as the final fallback, shown as readable plain text.
- Each step gives up after about 5 seconds and quietly moves on, so the lyrics view never hangs.
- A small "Lyrics from …" note shows the source.

## 2. Titles | Lyrics switch on Search
- A small pill next to the search box. The selected side is white with dark text, and the other side is faded.
- **Titles** (default): works exactly as it does now.
- **Lyrics**: type a line of a song, in Hindi script, English or Hinglish.
  1. Search LRCLIB's lyrics for the line and take the top few matching songs.
  2. Look up each match (title and artist) in the music library to find a playable version.
  3. Show the playable songs in the usual song row, so you can tap to play. Duplicates are removed.
- While this runs, a clear "Finding songs with that line…" loading state shows, since it takes two steps.
- If nothing matches, you see a friendly message suggesting another line or the Titles mode.
- Limitation: LRCLIB's lyrics search matches the words as they are stored. Hinglish lines find songs whose lyrics are stored in Hinglish, but may miss songs stored only in Hindi script (and the reverse).
- The Songs/Artists chips stay; the Lyrics mode applies to songs.

## Technical details
- `src/lib/lyrics.ts`: `fetchLyrics` becomes a waterfall: LRCLIB `/api/get` → `/api/search?track_name&artist_name` → JioSaavn `GET {BASE}/songs/{id}/lyrics` (`<br>` converted to newlines, HTML stripped). Each fetch uses `AbortSignal.timeout(5000)`, and the result includes `source`. `parseLRC` is unchanged.
- `src/lib/jiosaavn.ts`: add `fetchSaavnLyrics(id)`.
- New `searchByLyrics(text)` in `src/lib/lyrics.ts`: LRCLIB `/api/search?q=` → top 5 `{trackName, artistName}` → `searchSongs(`${track} ${artist}`)` in parallel → first hit for each, deduplicated by id.
- `src/routes/search.tsx`: add a `searchBy: "titles" | "lyrics"` state with the pill inside the search form. Lyrics mode uses a `useQuery(["search-lyrics", debounced])` with a minimum of 3 characters. It reuses `HorizontalRow`/`SearchRowCard` and keeps the existing debounce and history.
- `LyricsPane.tsx`: show the source note. The existing hard-coded colors move to theme tokens so the text is readable in Liquid Light.
- Unit tests in `src/lib/__tests__/lyrics.test.ts`: the waterfall falls back in order (mocked fetch), Saavn `<br>` parsing, and searchByLyrics deduplication.

## Verification
- Play a Bollywood track and an English track and confirm synced lyrics, and that the fallback appears when LRCLIB has nothing.
- On Search, switch to Lyrics, type "tum hi ho" and a Hinglish line, confirm the loading state, playable results, and tap to play. Check the build is clean.
