# Liquid glass polish for the dock and mini-player

## What changes
1. **Shared glass look**: The dock and the mini-player share one glass style. It has a soft diagonal sheen from light to deep blue-black, strong blur and saturation, a thin bright rim, a light highlight along the top edge, a shadow along the bottom edge, and a deep drop shadow underneath.
2. **Dock**: A centered pill, 92% of the screen width up to 390px wide, 64px tall, sitting 20px above the bottom of the screen. The active tab gets a raised glass lens with a faint teal glow. It still glides to the new tab in 300ms when you switch.
3. **Mini-player**: A centered capsule with the same width as the dock, floating 4px above it (88px from the bottom). It keeps the cover, title, artist, like, play/pause and next buttons, with soft white and grey icons. A thin teal-to-emerald progress line glows along its bottom edge.
4. **Light theme**: Liquid Light gets the same shapes and glow with a white-glass version of the sheen. Standard mode and desktop stay as they are.
5. **Spacing**: The spec asks for a fixed `pb-36`. Instead, the app keeps its current spacing setup, where the space kept free at the bottom depends on whether a song is loaded. The amounts get re-measured against the new sizes so the last row of content never hides behind the player or dock, and short pages don't get extra empty space.

## Technical details
- `src/styles.css`: add a `glass-liquid` utility (gradient, `backdrop-filter: blur(24px) saturate(190%)`, rim, layered inset and drop shadows) driven by `--glass-*` tokens, with light-theme overrides. Add tokens for the lens glow and progress gradient. Use only the standard `backdrop-filter` property, with no `-webkit-` duplicate.
- `MobileTabBar.tsx`: liquid nav becomes `fixed bottom-[calc(20px+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 w-[92%] max-w-[390px] h-16 rounded-full glass-liquid`. The lens is `rounded-full` with the glow shadow token, and the width and translateX logic stay the same.
- `MiniPlayer.tsx`: liquid variant becomes `left-1/2 -translate-x-1/2 w-[92%] max-w-[390px] bottom-[calc(88px+safe-area)] rounded-3xl glass-liquid`. Remove the conflicting base height class. The progress bar gets a 3px gradient fill with a glow.
- Geometry: the dock's top edge sits at 84px and the player's top edge at about 152px. Check the `__root.tsx` reserve (currently 92px) and the `AppShell` spacer (currently 70px) against these numbers, adjust only if the measurements require it, and update the rule in `AGENTS.md` if the values change.

## Verification
- Use Playwright at 393x671 in Liquid Dark and Liquid Light. Measure the dock and player boxes to confirm there is a gap and no overlap, switch tabs to check the lens moves under the right tab, and play a track to check the progress glow and controls.
- Scroll to the last Home row with and without a track loaded. Confirm Standard mode is unchanged and the build is clean.
