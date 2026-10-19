# Responsive scaling and viewport lock

## What changes
1. **Stop auto-zoom on phones** — lock the page scale (`maximum-scale=1, user-scalable=no, viewport-fit=cover`). Note: this also stops pinch-zoom for users.
2. **Full-screen player** — cover becomes `w-full max-w-[240px] md:max-w-[300px] aspect-square`; big play button `w-14 h-14 md:w-16 md:h-16`; title/artist block gets `min-w-0 flex-1` + `truncate`.
3. **Playlist page** — header cover from fixed `h-48 w-48` to `w-full max-w-[200px] aspect-square` (stacks on mobile); title text truncates; rows get `min-w-0`.
4. **Text overflow sweep** — add `min-w-0` / `truncate` to text beside artwork in song rows, player bar, mini player, and home/search/liked/library headers.
5. **Bottom space** — main scroll area gets `pb-[180px]` on mobile (liquid) / `pb-40` (standard), plus safe-area inset; app wrapper `min-h-[100dvh] overflow-x-hidden`. Desktop unchanged.

## Technical details
- Viewport meta in `src/routes/__root.tsx` head (no index.html in this stack).
- Files: `__root.tsx`, `ExpandedPlayer.tsx`, `routes/playlist.$id.tsx`, `SongCard.tsx`, `PlayerBar.tsx`, `MiniPlayer.tsx`, route headers as needed.
- Verify with Playwright at 360x640 and 390x844 in liquid-dark.
