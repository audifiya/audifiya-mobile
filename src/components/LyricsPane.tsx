import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { motion } from "framer-motion";
import { AlignJustify, Focus, MoveHorizontal } from "lucide-react";
import type { JSSong } from "@/lib/jiosaavn";
import { usePlayback } from "@/lib/playback-engine";
import { findActiveIndex, useLyrics } from "@/lib/lyrics";
import { getTrackMoodTheme, type TrackMood } from "@/lib/lyrics-mood";

type LyricsMode = "standard" | "instagram" | "ticker";
const MODE_KEY = "audifiya_lyrics_mode";

function moodActive(mood: TrackMood): { cls: string; style?: React.CSSProperties } {
  if (mood === "rocking")
    return {
      cls: "font-black uppercase tracking-tight animate-pulse",
      style: { color: "var(--lyric-rock)", textShadow: "0 4px 12px rgba(0,0,0,0.5)" },
    };
  if (mood === "melodic")
    return {
      cls: "font-semibold",
      style: {
        color: "var(--lyric-melodic)",
        fontFamily: "ui-rounded, 'Figtree', serif",
        filter: "drop-shadow(0 0 15px var(--lyric-melodic-glow))",
      },
    };
  return { cls: "font-bold text-foreground" };
}

export function LyricsPane({ song }: { song: JSSong | null }) {
  const { data, isLoading } = useLyrics(song);
  const lineRefs = useRef<Array<HTMLDivElement | null>>([]);
  const userScrolledAt = useRef<number>(0);
  const [mode, setMode] = useState<LyricsMode>("standard");
  const mood = getTrackMoodTheme(song);

  // The active line is derived inside the selector, so this component re-renders
  // only when the highlighted line changes, not on every time tick.
  const synced = data?.synced;
  const { active } = usePlayback(
    useShallow((s) => ({
      active: synced?.length ? findActiveIndex(synced, s.currentTime) : -1,
    })),
  );

  useEffect(() => {
    const v = localStorage.getItem(MODE_KEY);
    if (v === "standard" || v === "instagram" || v === "ticker") setMode(v);
  }, []);
  const pick = (m: LyricsMode) => {
    setMode(m);
    localStorage.setItem(MODE_KEY, m);
  };

  useEffect(() => {
    if (active < 0 || mode === "ticker") return;
    if (Date.now() - userScrolledAt.current < 4000) return;
    lineRefs.current[active]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [active, mode]);

  if (!song) return null;

  const switcher = (
    <div className="mx-auto mb-2 flex shrink-0 gap-1 rounded-full bg-glass-lens p-1">
      {(
        [
          ["standard", "Standard lyrics", AlignJustify],
          ["instagram", "Focus lyrics", Focus],
          ["ticker", "Ticker lyrics", MoveHorizontal],
        ] as const
      ).map(([id, label, Icon]) => (
        <button
          key={id}
          aria-label={label}
          aria-pressed={mode === id}
          onClick={() => pick(id)}
          className={`grid h-8 w-8 place-items-center rounded-full transition-colors ${
            mode === id ? "bg-foreground text-background" : "text-text-secondary"
          }`}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );

  if (isLoading) {
    return <div className="grid h-full place-items-center text-sm opacity-60">Loading lyrics…</div>;
  }

  const note = data?.source ? (
    <div className="shrink-0 pt-2 text-center text-[11px] text-text-muted">Lyrics from {data.source}</div>
  ) : null;

  const act = moodActive(mood);

  if (data?.synced?.length) {
    const lines = data.synced;
    return (
      <div className="flex h-full min-h-0 flex-col">
        {switcher}
        {mode === "ticker" ? (
          <Ticker lines={lines.map((l) => l.text || "♪")} active={active} act={act} />
        ) : (
          <div
            onWheel={() => (userScrolledAt.current = Date.now())}
            onTouchMove={() => (userScrolledAt.current = Date.now())}
            className={`no-scrollbar relative min-h-0 w-full flex-1 overflow-y-auto ${
              mode === "instagram" ? "text-left" : "text-center text-lg leading-relaxed"
            }`}
          >
            <div className="py-[25vh]">
              {lines.map((l, i) => {
                const isActive = i === active;
                let cls: string;
                let style: React.CSSProperties | undefined;
                if (mode === "instagram") {
                  cls = isActive
                    ? `my-4 origin-left scale-110 text-3xl md:text-4xl font-extrabold transition-all duration-500 ease-out ${act.cls}`
                    : "my-3 origin-left scale-90 text-lg md:text-xl font-medium text-foreground/40 blur-[1px] transition-all duration-500";
                } else {
                  cls = isActive
                    ? `my-3 scale-105 transition-all duration-300 ease-out ${act.cls}`
                    : i < active
                      ? "my-3 opacity-25 transition-all duration-500"
                      : "my-3 opacity-60 text-foreground transition-all duration-500";
                }
                if (isActive) style = act.style;
                return (
                  <div
                    key={i}
                    ref={(n) => {
                      lineRefs.current[i] = n;
                    }}
                    className={`will-change-transform ${cls}`}
                    style={style}
                  >
                    {l.text || "♪"}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {note}
      </div>
    );
  }

  if (data?.plain) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap py-8 text-center text-base leading-relaxed opacity-80">
          {data.plain}
        </div>
        {note}
      </div>
    );
  }

  return <div className="grid h-full place-items-center text-sm opacity-60">No lyrics found for this track.</div>;
}

function Ticker({
  lines,
  active,
  act,
}: {
  lines: string[];
  active: number;
  act: { cls: string; style?: React.CSSProperties };
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const refs = useRef<Array<HTMLSpanElement | null>>([]);
  const [x, setX] = useState(0);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const el = refs.current[Math.max(0, active)];
    if (!wrap || !el) return;
    setX(wrap.clientWidth / 2 - (el.offsetLeft + el.offsetWidth / 2));
  }, [active, lines]);

  return (
    <div ref={wrapRef} className="relative flex h-32 min-h-0 flex-1 items-center overflow-hidden whitespace-nowrap">
      <motion.div
        className="flex flex-row items-center gap-10"
        animate={{ x }}
        transition={{ type: "spring", stiffness: 120, damping: 22 }}
      >
        {lines.map((t, i) => {
          const isActive = i === Math.max(0, active);
          const isPast = i < active;
          return (
            <span
              key={i}
              ref={(n) => {
                refs.current[i] = n;
              }}
              className={`transition-all duration-500 ${
                isActive
                  ? `text-3xl ${act.cls}`
                  : isPast
                    ? "text-xl opacity-0"
                    : "text-xl text-foreground opacity-50"
              }`}
              style={isActive ? act.style : undefined}
            >
              {t}
            </span>
          );
        })}
      </motion.div>
    </div>
  );
}
