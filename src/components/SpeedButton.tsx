import { useShallow } from "zustand/react/shallow";
import { usePlayback } from "@/lib/playback-engine";

export function SpeedButton({ className = "" }: { className?: string }) {
  const { playbackRate, cyclePlaybackRate } = usePlayback(
    useShallow((s) => ({
      playbackRate: s.playbackRate,
      cyclePlaybackRate: s.cyclePlaybackRate,
    })),
  );
  const active = playbackRate !== 1;

  return (
    <button
      type="button"
      aria-label={`Playback speed ${playbackRate}x`}
      title="Playback speed"
      onClick={cyclePlaybackRate}
      className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold tabular-nums transition-colors hover:bg-white/10 ${className}`}
      style={{
        color: active ? "var(--color-brand)" : "var(--color-text-secondary)",
      }}
    >
      {playbackRate}x
    </button>
  );
}
