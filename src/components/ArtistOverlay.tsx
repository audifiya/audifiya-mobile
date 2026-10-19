import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Play, BadgeCheck } from "lucide-react";
import { useArtistView } from "@/lib/artist-view";
import { fetchArtistDetails, fetchArtistSongs, getThumbnail, getArtistString, type JSSong } from "@/lib/jiosaavn";
import { formatTime, usePlayback } from "@/lib/playback-engine";
import { decodeEntities } from "@/lib/utils";

export function ArtistOverlay() {
  const { open, artistId, artistName, close } = useArtistView();
  const playContext = usePlayback((s) => s.playContext);

  const songsQ = useQuery({
    queryKey: ["artist-songs", artistId, artistName],
    queryFn: () => fetchArtistSongs(artistId!, artistName ?? ""),
    enabled: open && !!artistId,
  });
  const detailsQ = useQuery({
    queryKey: ["artist-details", artistId],
    queryFn: () => fetchArtistDetails(artistId!),
    enabled: open && !!artistId,
  });

  const songs: JSSong[] = songsQ.data ?? [];
  const banner = detailsQ.data?.image?.[detailsQ.data.image.length - 1]?.url
    ?? (songs[0] ? getThumbnail(songs[0]) : "");
  const displayName = detailsQ.data?.name ?? artistName ?? "Artist";
  const isVerified = detailsQ.data?.isVerified ?? true;

  return (
    <div
      aria-hidden={!open}
      className="fixed inset-0 z-[60]"
      style={{
        transform: open ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)",
        pointerEvents: open ? "auto" : "none",
        backgroundColor: "#121212",
      }}
    >
      <div className="relative h-full w-full overflow-y-auto">
        {/* Hero */}
        <div className="relative h-[45vh] min-h-[300px] w-full overflow-hidden">
          {banner && (
            <img
              src={banner}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              style={{ filter: "brightness(0.55)" }}
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.4) 50%, #121212 100%)",
            }}
          />
          <button
            aria-label="Close artist"
            onClick={close}
            className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-black/50 backdrop-blur transition-colors hover:bg-black/70"
          >
            <ChevronDown className="h-6 w-6" />
          </button>
          <div className="absolute bottom-6 left-6 right-6 flex items-end gap-3">
            {isVerified && (
              <BadgeCheck className="h-7 w-7 shrink-0" style={{ color: "#3b82f6" }} fill="#3b82f6" color="#fff" />
            )}
            <h1 className="text-4xl font-bold leading-none md:text-7xl">{displayName}</h1>
          </div>
        </div>

        {/* Top tracks */}
        <div className="mx-auto max-w-4xl px-6 pb-24 pt-6">
          <h2 className="mb-4 text-xl font-bold">Popular</h2>
          {songsQ.isLoading && (
            <p className="text-sm opacity-60">Loading tracks…</p>
          )}
          {!songsQ.isLoading && songs.length === 0 && (
            <p className="text-sm opacity-60">No tracks found.</p>
          )}
          <ul className="flex flex-col">
            {songs.map((s, i) => (
              <li
                key={s.id}
                onClick={() => playContext(songs, i)}
                className="group grid cursor-pointer grid-cols-[24px_48px_1fr_auto_60px] items-center gap-4 rounded-md px-3 py-2 hover:bg-white/5"
              >
                <span className="text-sm tabular-nums opacity-60 group-hover:hidden">{i + 1}</span>
                <Play className="hidden h-4 w-4 fill-current group-hover:block" />
                <img src={getThumbnail(s)} alt="" className="h-12 w-12 rounded" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium" children={decodeEntities(s.name)} />
                  <div className="truncate text-xs opacity-60">{getArtistString(s)}</div>
                </div>
                <span className="truncate text-xs opacity-60">{s.album?.name ?? ""}</span>
                <span className="text-right text-xs tabular-nums opacity-60">
                  {formatTime(s.duration ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
