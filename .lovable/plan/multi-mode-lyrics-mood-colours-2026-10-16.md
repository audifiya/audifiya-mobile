# Multi-mode lyrics & mood colours

## What you'll see
1. **Clean lyrics screen** — on the Lyrics tab, the song pill, seek bar and Play/Next/Previous/Shuffle/Repeat are hidden. Only the header (close + speed), the blurred album-art background, the lyrics, and the bottom tab pill (needed to leave Lyrics) remain.
2. **Three lyric styles** with a small 3-icon switch above the lyrics (remembered between visits):
   - **Standard** — today's scrolling list.
   - **Focus** (Instagram/Spotify style) — current line big and bold, other lines smaller, faded and slightly blurred.
   - **Ticker** — one horizontal row; the current line is centred and large, upcoming lines wait faded on the right, past lines slide away left and fade out.
3. **Mood colours** guessed from the song title/artist/album/language:
   - Rocking (rock, metal, bass, edm, party, badshah): red, heavy uppercase, soft pulse.
   - Melodic (romantic, lofi, arijit, shreya, love, sad): rose/pink with a soft glow and rounded elegant font.
   - Neutral: standard theme text (works in light and dark themes).
   - Plain (unsynced) lyrics keep a simple scroll in all modes; ticker falls back to standard for them.

## Technical details
- New `src/lib/lyrics-mood.ts`: `getTrackMoodTheme(song)` returns `"rocking" | "melodic" | "neutral"`; keyword match on name, artists, album, language (case-insensitive, word-ish). Unit tests in `src/lib/__tests__/lyrics-mood.test.ts` (Badshah → rocking, Arijit → melodic, other → neutral).
- `lyricsMode` persisted in localStorage (`audifiya_lyrics_mode`), read in `useEffect` to avoid hydration mismatch.
- `LyricsPane` gets the mode switch and three renderers; ticker uses framer-motion `animate={{ x }}` computed from measured line offsets so the active line is centred.
- Mood colours added as CSS tokens in `src/styles.css` (`--lyric-rock`, `--lyric-melodic`) with light-theme variants; no hardcoded colours in components.
- `ExpandedPlayer`: wrap master pill, progress and controls in `tab !== "lyrics"`.
