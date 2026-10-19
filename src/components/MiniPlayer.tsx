import { useRef } from "react";
import { Play, Pause, SkipForward, Heart } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { usePlayback } from "@/lib/playback-engine";
import { getThumbnail } from "@/lib/jiosaavn";
import { toggleLiked, useLikedIds } from "@/lib/library";
import { MarqueeText } from "@/components/MarqueeText";
import { SafeImage } from "@/components/SafeImage";
import { useThemeMode } from "@/lib/theme-mode";
import { useGlassRefraction } from "@/components/GlassFilter";

export function MiniPlayer() {
  const { currentTrack, isPlaying, togglePlay, next, prev, setExpanded } = usePlayback(
    useShallow((s) => ({
      currentTrack: s.currentTrack,
      isPlaying: s.isPlaying,
      togglePlay: s.togglePlay,
      next: s.next,
      prev: s.prev,
      setExpanded: s.setExpanded,
    })),
  );
  // Progress comes from the playback store (native player events on Android,
  // <audio> sync on web/Electron), not from a DOM timeupdate listener.
  const currentTime = usePlayback((s) => s.currentTime);
  const duration = usePlayback((s) => s.duration);
  const pct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const likedIds = useLikedIds();
  const { liquid, light } = useThemeMode();
  const shellRef = useRef<HTMLDivElement>(null);
  const { svg, backdrop } = useGlassRefraction("playerGlassFilter", shellRef, {
    radius: 24,
    bezel: 18,
    blur: 14,
    saturate: 180,
  });
  const liked = currentTrack ? likedIds.has(currentTrack.id) : false;

  if (!currentTrack) return null;

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dy) > Math.abs(dx) && -dy > 50) {
      setExpanded(true);
      return;
    }
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) next();
      else prev();
    }
  };

  return (
    <div
      ref={shellRef}
      style={liquid && backdrop ? { backdropFilter: backdrop } : undefined}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onClick={() => setExpanded(true)}
      className={`fixed z-40 flex items-center justify-between overflow-hidden transition-all duration-500 ease-out md:hidden ${
        liquid
          ? "glass-liquid bottom-[calc(88px+var(--safe-bottom))] left-1/2 h-16 w-[92%] max-w-[390px] -translate-x-1/2 rounded-3xl py-1.5 pr-3 pl-2 motion-reduce:transition-none"
          : "bottom-[calc(65px+var(--safe-bottom))] left-0 right-0 h-[60px] rounded-none border-b border-black bg-[#181818] px-4"
      }`}
    >
      {liquid && svg}
      <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
        <SafeImage
          src={getThumbnail(currentTrack)}
          alt=""
          className="h-12 w-12 min-w-12 rounded-[10px] shadow-sm"
          iconSize={20}
        />
        <div className="flex min-w-0 flex-1 flex-col truncate">
          <div style={{ color: "var(--color-foreground)" }}>
            <MarqueeText text={currentTrack.name} className="text-sm font-bold" threshold={18} />
          </div>
          <span
            className="truncate text-xs"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {currentTrack.artists?.primary?.[0]?.name ?? ""}
          </span>
        </div>
      </div>

      <div className="ml-2 flex shrink-0 items-center gap-2">
        <button
          type="button"
          aria-label={liked ? "Remove from Liked Songs" : "Add to Liked Songs"}
          onClick={(e) => {
            e.stopPropagation();
            toggleLiked(currentTrack);
          }}
          className="grid h-9 w-9 place-items-center rounded-full"
          style={{
            color: liked ? "var(--color-brand)" : "var(--color-text-secondary)",
          }}
        >
          <Heart className="h-5 w-5" fill={liked ? "currentColor" : "none"} />
        </button>
        <button
          type="button"
          aria-label={isPlaying ? "Pause" : "Play"}
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className="grid h-10 w-10 place-items-center rounded-full"
          style={{ color: "var(--color-foreground)" }}
        >
          {isPlaying ? (
            <Pause className="h-7 w-7 fill-current" />
          ) : (
            <Play className="h-7 w-7 fill-current" />
          )}
        </button>
        <button
          type="button"
          aria-label="Next"
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
          className="grid h-9 w-9 place-items-center rounded-full"
          style={{ color: "var(--color-foreground)" }}
        >
          <SkipForward className="h-6 w-6 fill-current" />
        </button>
      </div>

      <div className="absolute bottom-0 left-5 right-5 h-[3px] rounded-full bg-glass-progress-track">
        <div
          className={`h-full rounded-full transition-all ${liquid ? "glass-progress-glow" : "bg-glass-progress"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}