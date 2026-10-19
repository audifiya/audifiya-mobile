import { getAudio } from "@/lib/remote-audio";
import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Volume1,
  Heart,
} from "lucide-react";
import {
  consumeNextTrack,
  formatTime,
  prepareNextTrack,
  usePlayback,
} from "@/lib/playback-engine";
import { getThumbnail } from "@/lib/jiosaavn";
import { toggleLiked, useLikedIds } from "@/lib/library";
import { AddToMenu } from "@/components/AddToMenu";
import { ArtistTag } from "@/components/ArtistTag";
import { SaveButton } from "@/components/SaveButton";
import { SpeedButton } from "@/components/SpeedButton";
import { WaveProgress } from "@/components/WaveProgress";
import { decodeEntities } from "@/lib/utils";
import { SafeImage } from "@/components/SafeImage";




export function PlayerBar() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const endGuard = useRef<string>("");
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [hoverBar, setHoverBar] = useState(false);
  const likedIds = useLikedIds();

  const {
    attachAudio,
    currentTrack,
    isPlaying,
    duration,
    volume,
    isMuted,
    isShuffleActive,
    isRepeatMode,
    togglePlay,
    next,
    prev,
    seekPercent,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    setExpanded,
  } = usePlayback(
    useShallow((s) => ({
      attachAudio: s.attachAudio,
      currentTrack: s.currentTrack,
      isPlaying: s.isPlaying,
      duration: s.duration,
      volume: s.volume,
      isMuted: s.isMuted,
      isShuffleActive: s.isShuffleActive,
      isRepeatMode: s.isRepeatMode,
      togglePlay: s.togglePlay,
      next: s.next,
      prev: s.prev,
      seekPercent: s.seekPercent,
      setVolume: s.setVolume,
      toggleMute: s.toggleMute,
      toggleShuffle: s.toggleShuffle,
      cycleRepeat: s.cycleRepeat,
      setExpanded: s.setExpanded,
    })),
  );

  // Progress display comes from the playback store (not a DOM listener).
  const currentTime = usePlayback((s) => s.currentTime);

  // Mount audio node once
  useEffect(() => {
    const el = getAudio();
    if (!el) return;
    audioRef.current = el;
    attachAudio(el);

    const advance = () => {
      if (!consumeNextTrack()) usePlayback.getState().next();
    };

    const onTime = () => {
      const t = el.currentTime;
      if (el.duration && isFinite(el.duration)) {
        // Pre-fetch the next track's stream URL well before the song ends.
        if (t / el.duration > 0.8) void prepareNextTrack();
        // Safety net: some streams never fire "ended"
        if (
          el.duration - t < 0.25 &&
          endGuard.current !== el.currentSrc + el.duration
        ) {
          endGuard.current = el.currentSrc + el.duration;
          advance();
        }
      }
    };
    const onLoaded = () => {
      endGuard.current = "";
      usePlayback.setState({ duration: el.duration || 0 });
    };
    const onPlay = () => {
      usePlayback.setState({ isPlaying: true });
    };
    const onPause = () => usePlayback.setState({ isPlaying: false });
    const onEnded = () => advance();

    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
    };
  }, [attachAudio]);




  const VolumeIcon =
    isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  const liked = currentTrack ? likedIds.has(currentTrack.id) : false;

  const onFooterTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onFooterTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dy) > Math.abs(dx) && -dy > 60) {
      if (currentTrack) setExpanded(true);
      return;
    }
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) next();
      else prev();
    }
  };

  return (
    <footer
      className="fixed bottom-0 left-0 z-40 hidden h-[calc(90px+var(--safe-bottom))] w-full items-center justify-between gap-4 border-t px-4 pb-safe md:flex"
      style={{
        backgroundColor: "var(--color-base)",
        borderColor: "var(--color-border)",
      }}
      onTouchStart={onFooterTouchStart}
      onTouchEnd={onFooterTouchEnd}
    >
      {/* Left: track meta (click to expand) */}
      <div className="flex w-[30%] min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={() => currentTrack && setExpanded(true)}
          aria-label="Open now playing"
          disabled={!currentTrack}
          className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-md p-1 text-left transition-colors select-none hover:bg-white/5 disabled:cursor-default disabled:hover:bg-transparent"
        >
          {currentTrack ? (
            <>
              <div className="h-12 w-12 min-h-[48px] min-w-[48px] max-h-[48px] max-w-[48px] flex-shrink-0 overflow-hidden rounded-md">
                <SafeImage
                  src={getThumbnail(currentTrack)}
                  alt=""
                  className="h-full w-full"
                  iconSize={20}
                />
              </div>
              <div className="min-w-0">
                <div
                  className="truncate text-sm font-medium"
                  children={decodeEntities(currentTrack.name)}
                />
                <div
                  className="truncate text-xs"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <ArtistTag song={currentTrack} />
                </div>
              </div>
            </>
          ) : (
            <div
              className="text-sm"
              style={{ color: "var(--color-text-muted)" }}
            >
              Nothing playing
            </div>
          )}
        </button>
        {currentTrack && (
          <>
            <button
              type="button"
              aria-label={liked ? "Remove from Liked Songs" : "Add to Liked Songs"}
              onClick={() => toggleLiked(currentTrack)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-white/10"
              style={{
                color: liked ? "var(--color-brand)" : "var(--color-text-secondary)",
              }}
            >
              <Heart
                className="h-4 w-4"
                fill={liked ? "currentColor" : "none"}
              />
            </button>
            <SaveButton song={currentTrack} size={16} />
            <AddToMenu song={currentTrack} align="left" />
          </>
        )}
      </div>


      {/* Center: playback + progress */}
      <div className="flex flex-1 flex-col items-center gap-2">
        <div className="flex items-center gap-4">
          <button
            aria-label="Shuffle"
            onClick={toggleShuffle}
            style={{
              color: isShuffleActive
                ? "var(--color-brand)"
                : "var(--color-text-secondary)",
            }}
          >
            <Shuffle className="h-4 w-4" />
          </button>
          <button
            aria-label="Previous"
            onClick={prev}
            style={{ color: "var(--color-text-secondary)" }}
            className="hover:!text-white"
          >
            <SkipBack className="h-5 w-5 fill-current" />
          </button>
          <button
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={togglePlay}
            className="grid h-9 w-9 place-items-center rounded-full transition-transform hover:scale-105"
            style={{ backgroundColor: "var(--color-foreground)" }}
          >
            {isPlaying ? (
              <Pause
                className="h-4 w-4 fill-current"
                style={{ color: "var(--color-background)" }}
              />
            ) : (
              <Play
                className="h-4 w-4 fill-current"
                style={{ color: "var(--color-background)" }}
              />
            )}
          </button>
          <button
            aria-label="Next"
            onClick={next}
            style={{ color: "var(--color-text-secondary)" }}
          >
            <SkipForward className="h-5 w-5 fill-current" />
          </button>
          <button
            aria-label="Repeat"
            onClick={cycleRepeat}
            style={{
              color:
                isRepeatMode > 0
                  ? "var(--color-brand)"
                  : "var(--color-text-secondary)",
            }}
          >
            {isRepeatMode === 2 ? (
              <Repeat1 className="h-4 w-4" />
            ) : (
              <Repeat className="h-4 w-4" />
            )}
          </button>
        </div>
        <div className="flex w-full items-center gap-2">
          <span
            className="w-10 text-right text-[11px] tabular-nums"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {formatTime(currentTime)}
          </span>
          <div
            id="progressBar"
            onMouseEnter={() => setHoverBar(true)}
            onMouseLeave={() => setHoverBar(false)}
            className="flex-1"
          >
            <WaveProgress
              onSeek={seekPercent}
              filledColor={
                hoverBar ? "var(--color-brand)" : "var(--color-foreground)"
              }
            />
          </div>
          <span
            className="w-10 text-[11px] tabular-nums"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Right: volume */}
      <div className="flex w-[20%] items-center justify-end gap-2">
        <SpeedButton />

        
        <button
          onClick={toggleMute}
          aria-label="Mute"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <VolumeIcon className="h-4 w-4" />
        </button>

        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={isMuted ? 0 : volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="h-1 w-24 cursor-pointer accent-white"
          aria-label="Volume"
        />
      </div>
    </footer>
  );
}