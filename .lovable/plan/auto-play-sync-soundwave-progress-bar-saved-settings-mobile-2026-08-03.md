# Auto-play sync, soundwave progress bar, saved settings, mobile mini-player rebuild

## 1. Reliable auto-advance at track end
The `ended` handler in `PlayerBar` already calls the store's `next()`, but `next()` bails out early in edge cases (empty queue, index at `-1`, shuffle loop when the queue has one item). Rework it so end-of-track always resolves:
- Read fresh state inside the handler (already the case via `usePlayback.getState()`).
- Validate the index: if `currentQueueIndex < queue.length - 1`, advance and play; if repeat-one, restart; if repeat-context, wrap to 0; otherwise stop cleanly.
- Guard against a stale/invalid index by re-locating the current track by id in the queue before advancing.
- Add a fallback timeupdate check (when `currentTime` reaches duration but `ended` never fires, as happens with some streams) so a track never silently stalls.

## 2. Soundwave progress bar
Replace the flat filled div with a `<canvas>` visualizer:
- Create a single shared `AudioContext` + `MediaElementAudioSourceNode` + `AnalyserNode` (`fftSize = 64`), created lazily on first user play gesture and resumed on every play.
- `requestAnimationFrame` loop reads `getByteFrequencyData` and draws chunky vertical bars; bars left of the playhead use the brand color, bars right of it use the muted track color, so the wave doubles as the progress fill.
- Clicking/dragging the canvas still seeks by percentage.
- Cancel the RAF and disconnect listeners on unmount; keep the context and source node singletons so re-mounts never re-wire the element.

Note on risk: a previous attempt at Web Audio routing (the equalizer) killed audio output and was rolled back. To avoid a repeat, the graph will always connect the source through to `destination`, will be created only after a user gesture, and if `AudioContext` creation or `createMediaElementSource` fails the bar automatically falls back to the current plain fill bar — audio is never routed through anything that can mute it.

## 3. Persistent volume and speed
- Save `{ volume, speed }` to `localStorage` under `spotify_settings` whenever the volume slider moves, mute toggles, or the speed button cycles.
- On mount, read the key and apply to both the store and the audio node (`volume`, `playbackRate`), re-applying `playbackRate` after each `src` change since browsers reset it.

## 4. Mobile mini-player rebuild (floating tab)
Below `md`, render a dedicated mobile bar instead of the desktop footer:
- Floating container: `fixed bottom-[65px] left-2 right-2 h-[56px] rounded-md shadow-lg flex items-center justify-between px-3 z-50 overflow-hidden`, using theme surface tokens rather than a hardcoded hex so the glass theme still works.
- Left: 36×36 artwork with fixed min-width, title and artist truncated inside a `max-w-[60%]` wrapper.
- Right: Heart, Play/Pause, Next — consistent icon sizing.
- 2px progress bar pinned to the container's bottom edge, width mapped to track percentage.
- Tap opens the expanded player; swipe-up and swipe left/right gestures are preserved.
- The desktop footer keeps its current layout and gains the canvas visualizer.

## Technical notes
- Files touched: `src/lib/playback-engine.ts` (queue-end logic, settings persistence), `src/components/PlayerBar.tsx` (desktop bar + canvas), a new `src/components/MiniPlayer.tsx` (mobile), a new `src/lib/audio-analyser.ts` (singleton graph with safe fallback), `src/components/SpeedButton.tsx` (persist on cycle).
- Padding under content is adjusted so the floating mobile bar doesn't cover the last row.
