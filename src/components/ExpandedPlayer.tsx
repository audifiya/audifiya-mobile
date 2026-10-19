import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  Radio,
  Disc3,
  AlignLeft,
  SlidersHorizontal,
  Info,
  Gauge,
} from "lucide-react";
import { formatTime, usePlayback } from "@/lib/playback-engine";
import { getThumbnail } from "@/lib/jiosaavn";
import { toggleLiked, useLikedIds } from "@/lib/library";
import { AddToMenu } from "@/components/AddToMenu";
import { LyricsPane } from "@/components/LyricsPane";
import { decodeEntities } from "@/lib/utils";
import { SafeImage, resolveImageUrl } from "@/components/SafeImage";
import { useThemeMode } from "@/lib/theme-mode";

type Tab = "now" | "lyrics" | "settings" | "info";

export function ExpandedPlayer() {
  const {
    isExpanded,
    setExpanded,
    currentTrack,
    isPlaying,
    duration,
    isShuffleActive,
    isRepeatMode,
    togglePlay,
    next,
    prev,
    seekPercent,
    toggleShuffle,
    cycleRepeat,
    isAutoPlayEnabled,
    toggleAutoPlay,
    playbackRate,
    cyclePlaybackRate,
    playContext,
  } = usePlayback(
    useShallow((s) => ({
      isExpanded: s.isExpanded,
      setExpanded: s.setExpanded,
      currentTrack: s.currentTrack,
      isPlaying: s.isPlaying,
      duration: s.duration,
      isShuffleActive: s.isShuffleActive,
      isRepeatMode: s.isRepeatMode,
      togglePlay: s.togglePlay,
      next: s.next,
      prev: s.prev,
      seekPercent: s.seekPercent,
      toggleShuffle: s.toggleShuffle,
      cycleRepeat: s.cycleRepeat,
      isAutoPlayEnabled: s.isAutoPlayEnabled,
      toggleAutoPlay: s.toggleAutoPlay,
      playbackRate: s.playbackRate,
      cyclePlaybackRate: s.cyclePlaybackRate,
      playContext: s.playContext,
    })),
  );
  const { liquid } = useThemeMode();

  const barRef = useRef<HTMLDivElement | null>(null);
  // Progress comes from the playback store (native player events on Android,
  // <audio> sync on web/Electron). While dragging the slider, dragPct wins.
  const currentTime = usePlayback((s) => s.currentTime);
  const [dragPct, setDragPct] = useState<number | null>(null);
  const releaseTimer = useRef<number | null>(null);
  const storePct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const pct = dragPct ?? storePct;
  const [dragY, setDragY] = useState(0);
  const seeking = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const atTop = useRef(true);
  const likedIds = useLikedIds();
  const isLiked = currentTrack ? likedIds.has(currentTrack.id) : false;
  const [tab, setTab] = useState<Tab>("now");

  useEffect(
    () => () => {
      if (releaseTimer.current) window.clearTimeout(releaseTimer.current);
    },
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    if (isExpanded) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isExpanded, setExpanded]);

  const img = currentTrack ? (resolveImageUrl(getThumbnail(currentTrack)) ?? "") : "";
  const artist = currentTrack?.artists?.primary?.map((a) => a.name).join(", ") ?? "";
  const meta = currentTrack as unknown as Record<string, unknown> | null;

  const ratioAt = (clientX: number) => {
    const r = barRef.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };
  const onSeekDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    seeking.current = true;
    if (releaseTimer.current) window.clearTimeout(releaseTimer.current);
    barRef.current?.setPointerCapture(e.pointerId);
    setDragPct(ratioAt(e.clientX) * 100);
  };
  const onSeekMove = (e: React.PointerEvent) => {
    if (seeking.current) setDragPct(ratioAt(e.clientX) * 100);
  };
  const onSeekUp = (e: React.PointerEvent) => {
    if (!seeking.current) return;
    seeking.current = false;
    seekPercent(ratioAt(e.clientX));
    // Hold the dragged position briefly so the bar doesn't snap back before the seek lands.
    releaseTimer.current = window.setTimeout(() => setDragPct(null), 400);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (seeking.current) return;
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
    atTop.current = (scrollRef.current?.scrollTop ?? 0) <= 0;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current || !atTop.current || seeking.current) return;
    const dy = e.touches[0].clientY - touchStart.current.y;
    if (dy > 0) setDragY(dy);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    setDragY(0);
    if (atTop.current && dy > 100 && Math.abs(dy) > Math.abs(dx)) {
      setExpanded(false);
      return;
    }
    if (tab === "now" && Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) next();
      else prev();
    }
  };

  const glassCircle = liquid ? "glass-pill" : "bg-surface-card border border-border";
  const pill = liquid ? "glass-pill" : "bg-surface-card border border-border";

  const TABS: { id: Tab; label: string; Icon: typeof Disc3 }[] = [
    { id: "now", label: "Now playing", Icon: Disc3 },
    { id: "lyrics", label: "Lyrics", Icon: AlignLeft },
    { id: "settings", label: "Playback settings", Icon: SlidersHorizontal },
    { id: "info", label: "Song info", Icon: Info },
  ];

  return (
    <div
      aria-hidden={!isExpanded}
      className="fixed inset-x-0 top-0 z-50 h-[100dvh] overflow-hidden bg-background text-foreground"
      style={{
        transform: isExpanded ? `translateY(${dragY}px)` : "translateY(100%)",
        transition: dragY > 0 ? "none" : "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)",
        pointerEvents: isExpanded ? "auto" : "none",
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Adaptive color wash */}
      {img && (
        <img
          src={img}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-3xl"
        />
      )}
      <div className="pointer-events-none absolute inset-0" style={{ background: "var(--player-wash)" }} />

      <div
        ref={scrollRef}
        className="relative z-10 mx-auto flex h-full max-w-[480px] flex-col overflow-y-auto pb-[calc(16px+var(--safe-bottom))]"
      >
        {/* Header */}
        <div className="flex w-full items-center justify-between gap-3 px-6 pt-[max(1.5rem,var(--safe-top))]">
          <button
            aria-label="Close player"
            onClick={() => setExpanded(false)}
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${glassCircle}`}
          >
            <ChevronDown className="h-6 w-6" />
          </button>
          <div className="min-w-0 truncate text-center text-sm font-medium">{decodeEntities(artist)}</div>
          <button
            aria-label={`Playback speed ${playbackRate}x`}
            onClick={cyclePlaybackRate}
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${glassCircle}`}
            style={{ color: playbackRate !== 1 ? "var(--color-brand)" : undefined }}
          >
            {playbackRate !== 1 ? (
              <span className="text-xs font-bold tabular-nums">{playbackRate}x</span>
            ) : (
              <Gauge className="h-5 w-5" />
            )}
          </button>
        </div>

        {tab === "lyrics" ? (
          <div className="mx-auto mt-4 flex min-h-0 w-[92%] flex-1 flex-col">
            <LyricsPane song={currentTrack} />
          </div>
        ) : (
          <>
            {tab === "now" ? (
              <SafeImage
                src={img}
                alt=""
                className="mx-auto mt-4 aspect-square w-[90%] max-w-[min(400px,42dvh)] shrink-0 rounded-lg shadow-2xl"
                iconSize={56}
              />
            ) : tab === "settings" ? (
              <div className={`mx-auto mt-4 flex w-[92%] flex-col gap-2 rounded-[2rem] p-4 ${pill}`}>
                <h2 className="px-1 text-sm font-bold">Playback settings</h2>
                <button
                  onClick={cyclePlaybackRate}
                  className="flex items-center justify-between rounded-2xl px-3 py-3 text-sm hover:bg-accent"
                >
                  <span>Playback speed</span>
                  <span className="font-bold tabular-nums">{playbackRate}x</span>
                </button>
                <button
                  onClick={toggleAutoPlay}
                  role="switch"
                  aria-checked={isAutoPlayEnabled}
                  className="flex items-center justify-between rounded-2xl px-3 py-3 text-sm hover:bg-accent"
                >
                  <span>Autoplay similar songs</span>
                  <span
                    className="relative h-6 w-11 rounded-full transition-colors"
                    style={{ background: isAutoPlayEnabled ? "var(--color-brand)" : "var(--player-track)" }}
                  >
                    <span
                      className="absolute top-0.5 h-5 w-5 rounded-full bg-foreground transition-all"
                      style={{ left: isAutoPlayEnabled ? 22 : 2 }}
                    />
                  </span>
                </button>
              </div>
            ) : (
              <div className={`mx-auto mt-4 w-[92%] rounded-[2rem] p-5 text-sm ${pill}`}>
                <h2 className="mb-3 font-bold">Song info</h2>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                  {[
                    ["Album", currentTrack?.album?.name],
                    ["Year", meta?.year as string | undefined],
                    ["Language", meta?.language as string | undefined],
                    ["Duration", currentTrack?.duration ? formatTime(currentTrack.duration) : undefined],
                    ["Artists", currentTrack?.artists?.all?.map((a) => a.name).join(", ") || artist],
                  ]
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-text-secondary">{k}</dt>
                        <dd className="min-w-0 break-words">{decodeEntities(String(v))}</dd>
                      </div>
                    ))}
                </dl>
              </div>
            )}

            {/* Master pill */}
            <div className={`mx-auto mt-6 flex w-[92%] items-center justify-between gap-3 rounded-[2rem] p-3 pl-5 ${pill}`}>
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-bold leading-tight">
                  {decodeEntities(currentTrack?.name ?? "Nothing playing")}
                </div>
                <div className="truncate text-sm text-text-secondary">{decodeEntities(artist)}</div>
              </div>
              {currentTrack && (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    aria-label="Start song radio"
                    onClick={() => playContext([currentTrack], 0, "search")}
                    className={`grid h-10 w-10 place-items-center rounded-full ${glassCircle}`}
                  >
                    <Radio className="h-5 w-5" />
                  </button>
                  <div className={`grid h-10 w-10 place-items-center rounded-full ${glassCircle}`}>
                    <AddToMenu song={currentTrack} align="right" color="currentColor" size={20} />
                  </div>
                  <button
                    aria-label={isLiked ? "Unlike" : "Like"}
                    onClick={() => toggleLiked(currentTrack)}
                    className={`grid h-10 w-10 place-items-center rounded-full ${glassCircle}`}
                    style={{ color: isLiked ? "var(--color-brand)" : undefined }}
                  >
                    <Heart className="h-5 w-5" fill={isLiked ? "currentColor" : "none"} />
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {tab !== "lyrics" && (
        <>
        {/* Progress */}
        <div className="mx-auto mt-5 w-[88%]">
          <div
            ref={barRef}
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
            onPointerDown={onSeekDown}
            onPointerMove={onSeekMove}
            onPointerUp={onSeekUp}
            onPointerCancel={onSeekUp}
            className="flex h-5 cursor-pointer touch-none items-center"
          >
            <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--player-track)" }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--player-fill)" }} />
            </div>
          </div>
          <div className="flex justify-between text-[11px] tabular-nums text-text-secondary">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="mx-auto mt-5 flex w-[92%] items-center justify-between">
          <button
            aria-label="Shuffle"
            onClick={toggleShuffle}
            className="grid h-10 w-10 place-items-center"
            style={{ color: isShuffleActive ? "var(--color-brand)" : undefined, opacity: isShuffleActive ? 1 : 0.75 }}
          >
            <Shuffle className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-6">
            <button aria-label="Previous" onClick={prev} className={`grid h-14 w-14 place-items-center rounded-full ${glassCircle}`}>
              <SkipBack className="h-6 w-6 fill-current" />
            </button>
            <button
              aria-label={isPlaying ? "Pause" : "Play"}
              onClick={togglePlay}
              className={`grid h-20 w-20 place-items-center rounded-full shadow-lg ${glassCircle}`}
            >
              {isPlaying ? <Pause className="h-9 w-9 fill-current" /> : <Play className="ml-1 h-9 w-9 fill-current" />}
            </button>
            <button aria-label="Next" onClick={next} className={`grid h-14 w-14 place-items-center rounded-full ${glassCircle}`}>
              <SkipForward className="h-6 w-6 fill-current" />
            </button>
          </div>
          <button
            aria-label="Repeat"
            onClick={cycleRepeat}
            className="grid h-10 w-10 place-items-center"
            style={{ color: isRepeatMode > 0 ? "var(--color-brand)" : undefined, opacity: isRepeatMode > 0 ? 1 : 0.75 }}
          >
            {isRepeatMode === 2 ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
          </button>
        </div>
        </>
        )}

        {tab !== "lyrics" && <div className="min-h-4 flex-1" />}

        {/* Bottom pill */}
        <div className={`mx-auto mt-4 flex h-14 w-[75%] max-w-[320px] shrink-0 items-center justify-around rounded-full px-2 ${pill}`}>
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              aria-label={label}
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
              className={`grid h-10 w-10 place-items-center rounded-full transition-colors ${
                tab === id ? "bg-glass-lens text-foreground" : "text-text-secondary"
              }`}
            >
              <Icon className="h-5 w-5" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}