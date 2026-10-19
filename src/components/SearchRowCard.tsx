import { getThumbnail, type JSSong } from "@/lib/jiosaavn";
import { usePlayback } from "@/lib/playback-engine";
import { useThemeMode } from "@/lib/theme-mode";
import { MarqueeText } from "@/components/MarqueeText";

export function HorizontalRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="scrollbar-hide -mx-1 flex snap-x snap-mandatory space-x-4 overflow-x-auto px-1 pb-4">
      {children}
    </div>
  );
}

export function SearchRowCard({ song }: { song: JSSong }) {
  const playContext = usePlayback((s) => s.playContext);
  const { light } = useThemeMode();
  const artist = song.artists?.primary?.[0]?.name ?? "";
  return (
    <button
      type="button"
      onClick={() => playContext([song], 0, "search")}
      className={`flex w-[140px] flex-none snap-start flex-col gap-2 rounded-lg p-2 text-left backdrop-blur-md transition-colors ${
        light
          ? "border border-black/5 bg-white/50 hover:bg-white/80"
          : "border border-white/10 bg-white/5 hover:bg-white/10"
      }`}
    >
      <img
        src={getThumbnail(song)}
        alt=""
        loading="lazy"
        className="aspect-square w-full rounded-md object-cover"
        style={{ backgroundColor: "var(--color-surface-card-hover)" }}
      />
      <MarqueeText
        text={song.name}
        className="text-sm font-semibold"
      />
      <span
        className="truncate text-xs"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {artist}
      </span>
    </button>
  );
}
