# Switch lyrics and lyric search to lrc.red

## What I confirmed
lrc.red's site loads its data from two addresses that other apps are allowed to call:
- **Search**: by title or artist, or, with a lyrics option, by a line from the song. In testing:
  - "kesariya tera ishq hai piya" found Kesariya (Brahmastra).
  - "is this the real life" found Bohemian Rhapsody.
  - "tum hi ho" found the Aashiqui 2 song.
- **Lyrics file**: time-synced lyrics for each song, for example Tum Hi Ho in Hinglish, word by word.

These addresses are undocumented, so they could change at any time. Every call is guarded, and the app falls back quietly if one fails.

## What changes
1. **LRCLIB removed** everywhere.
2. **Lyrics in the player**: lrc.red first, then the music library's own lyrics.
   - It searches lrc.red for the song's title and artist, and picks the match whose length is closest to the playing track.
   - It loads that song's synced lyrics, which highlight and scroll with the song as now.
   - If anything fails or nothing matches (within about 5 seconds), it shows the music library's plain lyrics.
   - The source note reads "Lyrics from lrc.red" or "Lyrics from JioSaavn".
3. **Search by lyrics**: the Titles | Lyrics switch stays. In Lyrics mode:
   - It searches lrc.red's lyrics for your line and takes the top 5 songs.
   - It finds each one in the music library so it can play.
   - It shows them in the song row, with duplicates removed.
   - The loading spinner and the "no songs found" message stay. The music library's direct-search backup added last time is removed, so this mode uses lrc.red only.

## Technical details
- `src/lib/lyrics.ts`:
  - `const LRCRED = "https://lrc.red"`.
  - `lrcRedSearch(q, inLyrics)` calls `GET /search.json?q=…[&in=lyrics]`, typed `{hits:{isrc,title,artist,album,duration,line?}[]}`.
  - `fetchLyrics(song)`:
    - searches `"${title} ${primaryArtist}"`, then picks the hit with the smallest duration difference (within ±10s if the duration is known, otherwise the first hit);
    - `GET /s/{isrc}.lrc`, then `parseLRC`;
    - else `fetchSaavnLyrics`.
  - Each fetch uses `AbortSignal.timeout(5000)` inside try/catch.
  - `LyricsSource` becomes `"lrc.red" | "JioSaavn"`.
- `parseLRC` also strips inline word stamps (`<00:10.23>`) and skips metadata tags like `[ti:]`.
- `searchByLyrics(text)`:
  - `lrcRedSearch(text, true)` → top 5, deduplicated by title and artist;
  - `searchSongs(`${title without "(From …)"} ${first artist}`)` in parallel;
  - first hit each, deduplicated by id.
- `src/routes/search.tsx`: no LRCLIB references to remove. The UI stays and keeps calling `searchByLyrics`.
- Update `src/lib/__tests__/lyrics.test.ts`:
  - lrc.red synced lyrics are used first;
  - the music library is used when lrc.red fails or has no match;
  - the closest-duration match is picked;
  - word stamps and metadata are stripped;
  - lyric search hands off to the music library and removes duplicates.

## Verification
- Run the tests.
- On Search in Lyrics mode, type "kesariya tera ishq hai piya" and confirm Kesariya appears and plays.
- Play Tum Hi Ho and confirm synced Hinglish lyrics with the lrc.red note.
- Check the build is clean.
