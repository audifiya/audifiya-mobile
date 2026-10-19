import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { usePlayback } from "@/lib/playback-engine";

const BAR_COUNT = 72;

// Deterministic per-bar animation config so the wave looks organic but stable.
const BARS = Array.from({ length: BAR_COUNT }, (_, i) => ({
  delay: `-${((i * 137) % 900) / 1000}s`,
  duration: `${0.7 + ((i * 53) % 45) / 100}s`,
}));

function BarRow({ color, playing }: { color: string; playing: boolean }) {
  return (
    <div className="flex h-full w-full items-end justify-between gap-[2px]">
      {BARS.map((b, i) => (
        <span
          key={i}
          className="wave-bar w-[2px] shrink-0 rounded-full"
          style={{
            backgroundColor: color,
            animationDelay: b.delay,
            animationDuration: b.duration,
            animationPlayState: playing ? "running" : "paused",
            height: playing ? undefined : "4px",
          }}
        />
      ))}
    </div>
  );
}

export function WaveProgress({
  className = "",
  filledColor = "var(--color-foreground)",
  trackColor = "rgba(255,255,255,0.28)",
  onSeek,
}: {
  className?: string;
  filledColor?: string;
  trackColor?: string;
  onSeek?: (pct: number) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const fillRef = useRef<HTMLDivElement | null>(null);
  // Playback state for the bar animation (re-renders only when it flips).
  const { isPlaying } = usePlayback(useShallow((s) => ({ isPlaying: s.isPlaying })));

  // Progress: updated straight from a store subscription, so the 144 bars never
  // re-render on a time tick. Reads the same store the native player / <audio> sync writes to.
  useEffect(() => {
    let last = -1;
    const apply = ({ currentTime, duration }: { currentTime: number; duration: number }) => {
      const fill = fillRef.current;
      if (!fill) return;
      const pct = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;
      if (pct === last) return;
      last = pct;
      fill.style.clipPath = `inset(0 ${(1 - pct) * 100}% 0 0)`;
    };
    apply(usePlayback.getState());
    return usePlayback.subscribe(apply);
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    onSeek((e.clientX - rect.left) / rect.width);
  };

  return (
    <div
      ref={wrapRef}
      onClick={handleClick}
      className={`relative h-4 w-full cursor-pointer ${className}`}
    >
      <div className="absolute inset-0">
        <BarRow color={trackColor} playing={isPlaying} />
      </div>
      <div
        ref={fillRef}
        className="pointer-events-none absolute inset-0"
        style={{ clipPath: "inset(0 100% 0 0)" }}
      >
        <BarRow color={filledColor} playing={isPlaying} />
      </div>
    </div>
  );
}
