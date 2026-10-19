# Reference-matched stacked glass player and dock

## What changes
1. **Three-tab glass dock** — keep AudiFiya’s Home, Search, and Library destinations, but rebuild the phone navigation as the reference’s wide bottom capsule: near-edge width, taller glass surface, large icons, labels underneath, and a brighter rounded active-tab lens.
2. **Stacked mini-player** — restyle the existing mini-player as the narrower capsule floating immediately above the dock, with album art and track details on the left, playback controls on the right, and the progress line along its lower edge.
3. **Unified glass treatment** — use layered translucent surfaces, strong background blur/saturation, subtle rim highlights, and soft depth shadows. Liquid Dark follows the smoky blue-grey reference; Liquid Light receives an equivalent light-glass treatment. Standard mode keeps its current flat bars.
4. **Interaction preservation** — retain tab routing, sliding active state, play/pause, next, like, progress, swipe gestures, and tap-to-expand behavior. The uploaded screenshots remain visual references only.
5. **Safe stacking** — align both capsules as one compact floating stack above the safe area and update the existing global reserve/player spacer only as much as the final measured geometry requires, so neither content nor controls overlap.

## Technical details
- Update `src/components/MobileTabBar.tsx` and `src/components/MiniPlayer.tsx`; adjust `src/routes/__root.tsx`, `src/components/AppShell.tsx`, and the bottom-spacing rule in `AGENTS.md` only if the new measured stack requires it.
- Put any new glass colors and shadows behind semantic tokens in `src/styles.css`; component markup will use those tokens instead of introducing raw color values.
- Keep the navigation mobile-only and preserve the current desktop player/navigation.
- Respect reduced-motion preferences for the active lens and bar transitions.

## Verification
- Check at 393×671 and the current 588×671 viewport in Liquid Dark and Liquid Light.
- Switch among all three tabs and confirm the active lens aligns and animates correctly.
- Start a track and verify artwork, title, artist, progress, play/pause, next, like, expansion, and swipe controls.
- Scroll Home to the final row with and without a loaded track; confirm the content, mini-player, dock, and chat button remain clear.
- Confirm Standard mode and desktop layout are unchanged, then check the latest build result.
