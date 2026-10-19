# Mini-player fix, karaoke lyrics, explicit local saving

## 1. Mini-player thumbnail (no more warping)

In the bottom player bar, the artwork gets wrapped in its own fixed 48x48 square box that cannot shrink, with the image filling it via `object-cover`. The text block next to it keeps truncating, so long titles no longer squeeze the image on narrow screens.

## 2. Karaoke lyric roll

The lyrics deck gets three animated states:

- Past lines: dim to 25%, slight blur, slide up 8px over 500ms.
- Active line: full opacity, brand green, bold, scaled 105%, soft green glow, 300ms.
- Upcoming lines: 60% opacity, white, offset down 8px, 500ms.

Each line gets an `id="lyric-line-{index}"`, and whenever the active index changes the deck smooth-scrolls that line to the vertical center. The existing 4-second grace period after a manual scroll stays.

## 3. Explicit "Save to Local Library"

- Auto-saving full song objects on every play stops. Playback history keeps only the last 5 entries, each trimmed to id, title, artist and thumbnail URL — enough for the Recently Played strip, without the bloat.
- A new bookmark button appears on the song card, the bottom player bar, and the expanded player. Clicking it writes the full song metadata to a dedicated saved-tracks store; clicking again removes it.
- Saved tracks show a filled green bookmark; unsaved show an outline. A short toast confirms each save/remove.

## Technical notes

- `src/components/PlayerBar.tsx`: wrap `<img>` in a `w-12 h-12 min-w-[48px] max-w-[48px] min-h-[48px] max-h-[48px] flex-shrink-0 overflow-hidden rounded-md` div; parent stays `flex items-center gap-3 overflow-hidden`.
- `src/components/LyricsPane.tsx`: per-line `id`, class sets per the animation rules above, `document.getElementById(...)?.scrollIntoView({ behavior: "smooth", block: "center" })` in the active-index effect.
- `src/lib/library.ts`:
  - `pushPlaybackHistory` stores a `MiniTrack` ({ id, name, artist, image }) capped at 5 under `spotify_playback_history`; readers migrate/ignore legacy full objects.
  - New `spotify_saved_offline_tracks` key with `readSaved`, `toggleSaved`, `useSavedIds` following the existing liked-songs pattern (event-driven sync).
- `src/lib/playback-engine.ts`: keeps calling `pushPlaybackHistory`, now writing only the minimal record.
- New `src/components/SaveButton.tsx` (bookmark toggle + toast) used by `SongCard.tsx`, `PlayerBar.tsx`, `ExpandedPlayer.tsx`.
- `src/routes/search.tsx`: Recently Played renders the minimal records; clicking one plays it by re-resolving via search when the full song body isn't present.
