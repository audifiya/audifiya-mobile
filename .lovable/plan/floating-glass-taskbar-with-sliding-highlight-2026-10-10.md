# Floating glass taskbar with sliding highlight

## What changes
1. **Floating pill dock** (Liquid Glass themes): the bottom nav on phones becomes a centered pill: 90% wide, at most 400px, 64px tall, 24px above the bottom, frosted dark glass with a thin light border and a soft shadow. Liquid Light gets the same shape in white glass.
2. **Sliding highlight**: one glowing glass capsule sits behind the active tab and glides smoothly (300ms) to Home, Search or Library when you switch tabs, instead of each tab lighting up on its own. Active icon and label turn white (black in Light); inactive ones are grey and brighten when you hover over them.
3. **Standard theme** keeps its current flat, full-width bar, so the Standard mini-player and spacing don't need to change.
4. On pages that don't match a tab (like a shared playlist), the highlight fades out.

## Spacing check
- The new dock's top edge sits 88px above the screen bottom, below the current 96px space kept free at the bottom in Liquid. The mini-player (115px up) and the chat bubble (90px up) don't need to move. Nothing else needs to shift.

## Technical details
- File: `src/components/MobileTabBar.tsx` only.
- Keep TanStack `Link` navigation and the current route matching (`/`, `/search`, `/library` + `/playlist*`) to work out `activeIndex` (-1 means no match).
- Liquid nav: `fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[400px] h-16 rounded-full z-50 flex items-center px-2 overflow-hidden backdrop-blur-xl border shadow-2xl`, with `bg-[#121212]/50 border-white/10` for dark and `bg-white/60 border-black/5` for light.
- Indicator: `absolute top-2 bottom-2 left-2 rounded-full transition-transform duration-300 ease-out`, width `calc((100% - 16px)/3)`, `transform: translateX(activeIndex * 100%)`, so it lines up exactly with three equal `flex-1` tabs. Opacity is 0 when activeIndex is -1.
- Tabs: `flex-1 z-10 flex flex-col items-center justify-center`, icon `h-6 w-6`, label `text-[10px] mt-1`.
- Only the standard `backdrop-filter` is used (no -webkit- prefix). Desktop is unaffected (`md:hidden`).

## Verification
- Playwright at 393x671 in liquid-dark, liquid-light and standard: screenshot the dock, switch tabs, and confirm the highlight moves under the right tab. Also confirm the last row of content and the mini-player stay clear of the dock.
