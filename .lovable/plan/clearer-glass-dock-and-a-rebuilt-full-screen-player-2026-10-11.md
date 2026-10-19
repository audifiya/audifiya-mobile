# Clearer glass dock and a rebuilt full-screen player

## 1. Dock transparency
- The dock becomes clearly see-through: a dark tint at 50%, heavier blur (40px), a thin light rim and a soft drop shadow. The selected-tab bubble is a faint white pill with a bright top edge and a gentle glow. The refraction, spring and drag stay as they are.
- Liquid Light gets a matching see-through white tint.

## 2. Full-screen player, rebuilt to the reference
1. **Color wash background**: The album cover fills the screen, zoomed in and heavily blurred, under a dark gradient (or a light one in Liquid Light) so the colors follow the song.
2. **Top bar**: A round glass minimize button on the left, the artist name in the middle, and a round glass button on the right. A browser can't cast audio, so the right button opens playback speed instead of a Cast button.
3. **Large cover**: 90% of the screen width, up to 400px, with rounded corners and a deep shadow.
4. **Track pill**: A wide glass pill with the title and artist on the left and three round glass buttons on the right: Radio (starts a song radio from this track), Add to playlist and Like.
5. **Progress**: A thin white bar with the times underneath. It replaces the current wave-style bar in this screen only, and you can still tap and drag it to seek.
6. **Controls**: A big glass play/pause circle, medium glass circles for previous and next, and plain shuffle and repeat icons at the edges. These keep the current green highlight when on.
7. **Bottom pill**: Four icons, with the active one highlighted:
   - Disc: the main player view
   - Lines: lyrics, which is the existing lyrics view
   - Sliders: playback settings (speed and autoplay)
   - Info: song details (album, year, language, duration, artists), using information the app already has
8. Swipe-down-to-close, the small-phone scrolling, Media Session controls and Standard theme behavior all stay. In Standard theme, the rebuilt layout uses flat dark surfaces instead of glass.

## Technical details
- `MobileTabBar.tsx`: replace `glass-liquid` on the liquid nav with `bg-[#09090b]/50 backdrop-blur-[40px] border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.5)]`, expressed as `--glass-dock-*` tokens in `styles.css`, with light overrides. The lens gets the spec's pill styles via tokens, and the refraction `backdropFilter` is kept when supported.
- `ExpandedPlayer.tsx`: restructure the layout. Keep `usePlayback` actions, `AddToMenu`, `LyricsPane`, `SpeedButton` logic and `toggleLiked`. The tab state widens to `"now" | "lyrics" | "settings" | "info"`. Radio calls `playContext([currentTrack], 0, "search_radio")`. A new slim seek bar reads the `#nativeAudio` time and duration and handles pointer seeking. The blurred background `<img>` sits behind a gradient overlay. Glass surfaces use semantic tokens and the standard `backdrop-filter` only.
- Confirm no solid background sits behind the dock (it is fixed to the screen and the page behind it is already transparent in Liquid).

## Verification
- Run Playwright at 393x671 in Liquid Dark, Liquid Light and Standard. Open a track in the full-screen player, then check the background tint, each pill tab, play/pause, previous/next, shuffle/repeat, seeking, Radio, Add to playlist, Like, and swipe-down to close. Check that it scrolls on a 360x640 screen. Screenshot the dock over content to confirm it is see-through. Check the build is clean.
