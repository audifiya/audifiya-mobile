# Player fit on small phones, sliding search rows, scrolling titles

## 1. Expanded player fits short screens
- Outer panel uses `h-[100dvh]`; content column becomes `flex flex-col overflow-y-auto` so it can scroll.
- Album art constrained: `w-full max-w-[350px] aspect-square max-h-[40vh] mx-auto rounded-xl shadow-2xl object-cover`.
- Controls block gets `pb-20` so Play/Pause can always be scrolled fully into view.
- Swipe-down-to-close only triggers when the content is scrolled to the top, so scrolling isn't hijacked.

## 2. Search results as a sliding row
- Song results render in `flex overflow-x-auto snap-x snap-mandatory space-x-4 pb-4 scrollbar-hide`.
- New compact card: `flex-none w-[140px] snap-start flex flex-col gap-2 rounded-lg bg-white/5 p-2 backdrop-blur-md border border-white/10` with cover, title, artist; tap plays with the existing search-radio behaviour. Light theme gets a matching light variant.
- Artists row keeps its circular cards (already fits).

## 3. Scrolling (marquee) titles
- Add `marquee` keyframes, `.animate-marquee` and `.scrollbar-hide` to global styles (reduced-motion disables the marquee).
- Reusable `MarqueeText`: outer `w-full overflow-hidden`, inner `animate-marquee` when title > 15 characters, else `truncate`. Used in the new cards (and the mini player title).

## 4. "Similar to your search" row
- When results load, silently fetch recommendations for the top result's id (existing `fetchRecommendations`, cached per id).
- Rendered below results in the same sliding row; hidden if empty.

## Technical notes
- Files: `ExpandedPlayer.tsx`, `routes/search.tsx`, new `components/SearchRowCard.tsx`, new `components/MarqueeText.tsx`, `styles.css`, `MiniPlayer.tsx`.
- The grid/list layout toggle is removed from search results only; other pages keep it.
