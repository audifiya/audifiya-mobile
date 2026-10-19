<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

### Bottom spacing architecture
The app is a fixed-height shell (`h-[100dvh]`, internal scroll) — never give pages their own document-flow padding for floating UI. The global bottom reserve lives in `__root.tsx`'s inner wrapper (92px liquid / 85px standard + safe-area, matching the tab bar only); extra clearance for the mini-player is a conditional spacer `<div>` at the end of AppShell's scroll container (70px liquid / 40px standard), rendered only when `currentTrack` is set. The chat FAB hides on scroll-down, so it must not be counted in the reserve.

### Web app + Chrome extension
The same code ships as the website and as an MV3 side-panel extension (`extension/` + `scripts/build-extension.mjs`, `bun run build:extension` → `public/audifiya-extension.zip`). Always get the player's audio via `getAudio()` from `src/lib/remote-audio.ts`, never `#nativeAudio` directly — in the extension it returns a shim that drives an offscreen document so playback survives closing the panel. Gate every `chrome.*` call behind `isExtension()`. Rebuild the zip after app changes so the extension stays current.
