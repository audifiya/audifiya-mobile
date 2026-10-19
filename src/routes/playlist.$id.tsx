import { createFileRoute, useParams } from "@tanstack/react-router";
import { Play, Music2, Trash2, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { deletePlaylist, getPlaylist, removeSongFromPlaylist, type Playlist } from "@/lib/library";
import { createShareLink } from "@/lib/share";
import { toast } from "sonner";
import { getArtistString, getThumbnail } from "@/lib/jiosaavn";
import { formatTime, usePlayback } from "@/lib/playback-engine";
import { decodeEntities } from "@/lib/utils";

export const Route = createFileRoute("/playlist/$id")({
  head: () => ({
    meta: [
      { title: "Playlist — AudiFiya" },
      { name: "description", content: "Your saved playlist." },
    ],
  }),
  component: PlaylistPage,
});

function PlaylistPage() {
  const { id } = useParams({ from: "/playlist/$id" });
  const [pl, setPl] = useState<Playlist | undefined>(undefined);
  const playContext = usePlayback((s) => s.playContext);
  const currentId = usePlayback((s) => s.currentTrack?.id);

  useEffect(() => {
    setPl(getPlaylist(id));
    const h = () => setPl(getPlaylist(id));
    window.addEventListener("app-playlists-changed", h);
    return () => window.removeEventListener("app-playlists-changed", h);
  }, [id]);

  if (!pl) {
    return (
      <AppShell>
        <p className="pt-8" style={{ color: "var(--color-text-secondary)" }}>
          Playlist not found.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col items-center gap-4 pt-6 sm:flex-row sm:items-end sm:gap-6">
        <div
          className="grid aspect-square w-full max-w-[200px] shrink-0 place-items-center rounded-lg shadow-xl"
          style={{
            background:
              "linear-gradient(135deg, var(--color-brand) 0%, #0d5a2b 100%)",
          }}
        >
          <Music2 className="h-16 w-16" color="#000" />
        </div>
        <div className="w-full min-w-0 flex-1 text-center sm:text-left">
          <p className="text-xs font-bold uppercase">Playlist</p>
          <h1 className="mt-2 truncate text-3xl font-extrabold sm:text-5xl">{pl.name}</h1>
          <p
            className="mt-4 text-sm"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {pl.songs.length} songs
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          disabled={pl.songs.length === 0}
          onClick={() => playContext(pl.songs, 0)}
          aria-label="Play playlist"
          className="grid h-14 w-14 place-items-center rounded-full transition-transform hover:scale-105 disabled:opacity-40"
          style={{ backgroundColor: "var(--color-brand)" }}
        >
          <Play className="h-6 w-6 fill-black text-black" />
        </button>
        <button
          disabled={pl.songs.length === 0}
          className="disabled:opacity-40"
          onClick={async () => {
            let url: string;
            try {
              url = await createShareLink(pl.songs.map((s) => s.id));
            } catch {
              toast.error("Couldn't create share link. Try again.");
              return;
            }
            try {
              await navigator.clipboard.writeText(url);
              toast.success("Playlist link copied! Valid for 7 days.");
            } catch {
              prompt("Copy this link:", url);
            }
          }}
          aria-label="Share playlist"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <Share2 className="h-5 w-5" />
        </button>
        <button
          onClick={() => {
            if (confirm(`Delete playlist "${pl.name}"?`)) {
              deletePlaylist(pl.id);
              history.back();
            }
          }}
          aria-label="Delete playlist"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-8">
        {pl.songs.length === 0 ? (
          <p style={{ color: "var(--color-text-secondary)" }}>
            No songs yet. Add some from search or the home page.
          </p>
        ) : (
          <ul className="flex flex-col">
            {pl.songs.map((song, i) => {
              const active = currentId === song.id;
              return (
                <li
                  key={song.id}
                  onClick={() => playContext(pl.songs, i)}
                  className="grid cursor-pointer grid-cols-[24px_40px_1fr_auto_32px] items-center gap-4 rounded-md px-3 py-2 hover:bg-surface-card-hover"
                >
                  <span
                    className="text-sm tabular-nums"
                    style={{
                      color: active
                        ? "var(--color-brand)"
                        : "var(--color-text-secondary)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <img
                    src={getThumbnail(song)}
                    alt=""
                    className="h-10 w-10 rounded"
                  />
                  <div className="min-w-0">
                    <div
                      className="truncate text-sm font-medium"
                      style={{
                        color: active
                          ? "var(--color-brand)"
                          : "var(--color-foreground)",
                      }}
                      children={decodeEntities(song.name)}
                    />
                    <div
                      className="truncate text-xs"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      {getArtistString(song)}
                    </div>
                  </div>
                  <span
                    className="text-right text-xs tabular-nums"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {formatTime(song.duration ?? 0)}
                  </span>
                  <button
                    aria-label={`Remove ${decodeEntities(song.name)} from playlist`}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSongFromPlaylist(pl.id, song.id);
                      toast.success("Removed from playlist");
                    }}
                    className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
