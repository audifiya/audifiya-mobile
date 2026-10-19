# Refraction glass lens and springy, draggable tab dock

## What changes
1. **Real lens refraction**: The glowing bubble behind the selected tab acts like a curved glass lens. Whatever scrolls behind it bends and magnifies slightly at the edges, and its top rim catches a light highlight.
2. **Spring motion**: When you switch tabs, the bubble springs to the new tab with a little overshoot and settles, instead of sliding at a fixed speed.
3. **Drag to switch**: You can press the bubble and drag it along the bar. It swells to about 1.25x while you hold it, gets harder to pull past the first or last tab, and when you let go it snaps to the nearest tab and opens that page. A plain tap on a tab still works as it does now.
4. **Mini-player**: Gets the same refraction glass on its surface, with no dragging, so its current swipe gestures (skip, open the full player) keep working.
5. **Fallbacks**: Bending the content behind an element only works in Chrome-based browsers, including Android Chrome. Safari, iPhones and Firefox keep the current frosted glass and still get the spring and drag. Phones set to reduce motion get an instant jump with no bounce.
6. Standard theme and desktop stay unchanged.

## Technical details
- Add `framer-motion`.
- New `src/lib/glass-maps.ts`: canvas generators, called only in `useEffect` on the client, that build a convex-squircle displacement map (X and Y slope encoded in the R and G channels, neutral at 128) and a top-rim specular map. Both are returned as data URLs, sized to the element and cached per size.
- New `GlassFilter` component that renders a hidden `<svg>` with a filter given a unique id: feGaussianBlur → feImage (displacement) → feDisplacementMap scale 30 → saturate 1.2 → feImage (specular) → feBlend screen. The spec says to use `filter: url(#…)`, but that would only bend the bubble itself, not what is behind it. To get the refraction, the lens is applied as `backdrop-filter: url(#id) blur() saturate()` only when the browser passes a supports check for SVG backdrop filters, which in practice means Chromium. Otherwise the existing `glass-liquid` blur is used.
- `MobileTabBar.tsx`: the indicator becomes a `motion.div` with `x` set to `activeIndex * tabWidth`, the tab width measured with a ResizeObserver. It uses `transition={{ type: "spring", stiffness: 500, damping: 24 }}`. Dragging is pointer based (pointerdown → scale 1.25 plus pointer capture, pointermove → x with `Math.exp` resistance outside [0, 2*tabWidth], pointerup → round to the nearest index and `navigate` there). Movement under a few pixels counts as a tap and is left to the `Link`. The bubble fades out on pages that don't match a tab, as it does now.
- `MiniPlayer.tsx`: uses `GlassFilter` with its own id and map sizes, and gets no motion changes.
- Use `useReducedMotion` to switch the spring to an instant change.

## Verification
- Run Playwright at 393x671 in Chromium, Liquid Dark and Liquid Light. Tap each tab and check the bubble springs to the right place. Simulate a drag from Home to Library and confirm the route changes and the bubble snaps into place. Drag past the end and confirm it is held back. Check the mini-player buttons and the swipe-to-skip and swipe-to-open gestures still work. Check the build is clean.
