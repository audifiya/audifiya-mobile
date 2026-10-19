# Global bottom safe-area padding

Raise the app's global bottom scroll reserve so the last row of content always scrolls fully above the floating Liquid Glass nav, mini-player, and chat bubble.

## Current state (measured at 393x671, liquid-dark)

Floating overlay stack, bottom edge to top edge above viewport bottom:

```text
Tab bar      24px  + 72px tall  -> top at  96px
Mini player 115px  + 60px tall  -> top at 175px
Chat bubble 200px  + 56px tall  -> top at 256px   (tallest — the limit)
Standard:   chat bubble top at 206px
```

Current scroll reserve in the root layout: 190px (liquid) / 130px (standard) + safe-area inset. Content only clears the bubble by ~30px; with iOS home-bar insets and browser chrome the margin disappears and the bubble/nav cover the last section (e.g. "Recommended for you").

## Changes

1. `src/routes/__root.tsx` — raise the mobile bottom reserve on the layout row that wraps Sidebar + main:
   - Liquid: `pb-[calc(190px+env(safe-area-inset-bottom))]` → `pb-[calc(260px+env(safe-area-inset-bottom))]`
   - Standard: `pb-[calc(130px+env(safe-area-inset-bottom))]` → `pb-[calc(210px+env(safe-area-inset-bottom))]`
   - Desktop unchanged (`md:pb-[90px]` still wins).
2. `src/components/AppShell.tsx` — keep the in-scroll `pb-24` mobile spacer as-is (it stays as extra breathing room under the last card); desktop `md:pb-8` unchanged.

No other files. No changes to the floating elements themselves, playback, or data.

## Result

The scrollable area now ends above the chat bubble in both themes, so any page's final row (including "Recommended for you" and "Recently played") can scroll completely into view, with ~30px+ of clear space above the tallest floating element even with iOS safe-area insets.

## Verification

- Playwright at 393x671 and 360x640 in liquid-dark and standard: scroll each page to the bottom and confirm the last content row's bottom edge is above the chat bubble's top edge (no overlap).
- Confirm desktop (1280px wide) layout is unchanged.
