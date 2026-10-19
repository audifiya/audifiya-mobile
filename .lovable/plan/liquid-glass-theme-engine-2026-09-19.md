# Liquid Glass Theme Engine

Replace the current Sparkles on/off glass switch with a proper two-mode theme engine (`standard` / `liquid`) that restyles the bottom navigation, mini-player, and search controls.

## 1. Theme state

- New `src/lib/theme-mode.ts` rewrite: `themeMode` store with values `'standard' | 'liquid'`.
- Reads `localStorage` key `audifiya_theme` on load, defaults to `'liquid'`.
- `toggleTheme()` flips the value and writes it back.
- Sets `liquid-theme` / `standard-theme` classes on the document root so global CSS can follow, but component styling is done with class ternaries as specified.
- Existing `spotify_glass_mode` key is migrated once: an old value of `1` maps to `liquid`.

## 2. Toggle control

- New pill switch (`w-14 h-8 rounded-full`) placed where the Sparkles button lives today: mobile top bar and desktop sidebar footer.
- Standard: dark track `#2a2a2a`, solid white thumb with a grid icon.
- Liquid: translucent blurred track with a light border, thumb with a droplet icon.
- Thumb slides with `transition-transform duration-300`.

## 3. Mobile navigation bar

- Liquid: floating capsule — `fixed bottom-6 left-4 right-4 h-[72px] rounded-[36px]`, `bg-black/40 backdrop-blur-[40px] saturate-[180%]`, `border-white/15`, deep shadow.
- Standard: current flat bar — full-width, `h-[65px]`, solid `#121212`, top border.
- Both share `transition-all duration-500 ease-out`.

## 4. Nested active tab

- Each tab is a `w-[75px] h-[54px]` column.
- Active in liquid: nested capsule `bg-white/[0.12] rounded-[24px]` with inset highlight shadow.
- Active in standard: transparent, brand/emerald text.
- Inactive: transparent with a subtle hover wash and muted text.

## 5. Floating mini-player

- Liquid: `fixed bottom-[115px] left-4 right-4 h-[60px] rounded-[30px]`, `bg-[#181818]/50 backdrop-blur-[50px] saturate-[200%]`, `border-white/20`, large shadow.
- Standard: edge-to-edge bar at `bottom-[65px]`, solid `#181818`, square corners.
- Progress line and controls stay as they are; the rounded variant clips the progress line to the capsule.

## 6. Search input and chips

- Liquid search field: full-height pill, `bg-white/10 backdrop-blur-xl border-white/15`, inset highlight, brighter on focus.
- Liquid chips (Songs/Artists pills, history chips): `rounded-full bg-white/5 backdrop-blur-md border-white/10` with hover lift.
- Standard keeps the existing look.

## 7. Layout spacing

- The app's bottom padding adjusts by mode so the floating capsules never overlap content (taller reserve in liquid mode).

## Technical notes

- Files touched: `src/lib/theme-mode.ts` (rewrite), new `src/components/ThemeToggle.tsx`, `src/components/MobileTabBar.tsx`, `src/components/MiniPlayer.tsx`, `src/components/AppShell.tsx`, `src/components/Sidebar.tsx`, `src/routes/search.tsx`, `src/routes/__root.tsx`, `src/styles.css`.
- The blanket `html.glass-theme` CSS overrides in `styles.css` are replaced by the per-component ternaries so the two modes stay predictable; the ambient gradient backdrop is kept for liquid mode.
- Only standard `backdrop-filter` is used (no hand-written `-webkit-` prefixes).
- No changes to playback, data fetching, or storage other than the new theme key.
