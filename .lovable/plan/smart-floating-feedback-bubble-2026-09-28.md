# Smart floating feedback bubble

## What changes
1. **Form only exists when open** — already the case; keep it and make sure it floats above the page (never pushes anything). The form also closes when you tap outside or press Escape.
2. **Hide on scroll down, show on scroll up** — the bubble slides off to the right (fades out) once you've scrolled more than 50px down, and slides back when you scroll up or reach the top. An open form closes when the bubble hides.
3. **Clear of the bottom bars on phones** — the bubble sits above the floating tab bar and mini player: about 200px up in Liquid Glass, about 150px in Standard, 32px from the bottom on desktop. It moves with a smooth 500ms slide.

## Technical details
- File: `src/components/FeedbackModal.tsx` only.
- The page scrolls inside an inner panel, not the window, so `window.scrollY` never changes. Instead: `document.addEventListener("scroll", handler, { capture: true, passive: true })`, reading `scrollTop` from the element that fired the event, and keeping the last value in a ref, not state, so the page doesn't re-render on every scroll. Window scroll is also handled as a fallback.
- Wrapper classes: `fixed right-4 md:right-8 z-[60] transition-all duration-500 ease-in-out` + `opacity-100 translate-x-0` / `opacity-0 translate-x-12 pointer-events-none`; bottom offset from `useThemeMode().liquid`, plus the phone's safe area.
