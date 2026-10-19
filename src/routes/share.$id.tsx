import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { Play, Link2Off, Loader2, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { loadSharedPlaylist } from "@/lib/share";
import { fetchSongsByIds, getArtistString, getThumbnail, type JSSong } from "@/lib/jiosaavn";
import { addSongToPlaylist, createPlaylist } from "@/lib/library";
import { usePlayback } from "@/lib/playback-engine";
import { decodeEntities } from "@/lib/utils";

export const Route = createFileRoute("/share/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Shared Playlist — AudiFiya" },
      { name: "description", content: "Listen to a playlist a friend shared with you on AudiFiya." },
      { property: "og:title", content: "Shared Playlist — AudiFiya" },
      { property: "og:description", content: "Listen to a playlist a friend shared with you on AudiFiya." },
      { property: "og:type", content: "music.playlist" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SharePage,
});

type State =
  | { kind: "loading" }
  | { kind: "expired" }
  | { kind: "error" }
  | { kind: "ready"; songs: JSSong[] };

function SharePage() {
  const { id } = useParams({ from: "/share/$id" });
  const [state, setState] = useState<State>({ kind: "loading" });
  const playContext = usePlayback((s) => s.playContext);
  const currentId = usePlayback((s) => s.currentTrack?.id);
  const started = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await loadSharedPlaylist(id);
        if (cancelled) return;
        if (res.status === "expired") return setState({ kind: "expired" });
        const songs = await fetchSongsByIds(res.songIds);
        if (cancelled) return;
        if (!songs.length) return setState({ kind: "error" });
        setState({ kind: "ready", songs });
        if (!started.current) {
          started.current = true;
          playContext(songs, 0, "playlist" as never);
        }
      } catch {
        if (!cancelled) setState({ kind: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, playContext]);

  if (state.kind === "loading") {
    return (
      <AppShell>
        <div className="grid place-items-center pt-24">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--color-brand)" }} />
        </div>
      </AppShell>
    );
  }

  if (state.kind !== "ready") {
    return (
      <AppShell>
        <div className="grid place-items-center pt-16">
          <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-white/5 p-8 text-center backdrop-blur-3xl">
            <Link2Off className="mx-auto h-10 w-10" style={{ color: "var(--color-text-secondary)" }} />
            <h1 className="mt-4 text-xl font-bold">
              {state.kind === "expired" ? "This playlist link has expired." : "Couldn't load this playlist."}
            </h1>
            <p className="mt-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
              {state.kind === "expired"
                ? "Shared links stay valid for 7 days. Ask your friend for a new one."
                : "Please check your connection and try again."}
            </p>
            <Link
              to="/"
              className="mt-6 inline-block rounded-full px-6 py-2 text-sm font-semibold text-black"
              style={{ backgroundColor: "var(--color-brand)" }}
            >
              Go home
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const { songs } = state;
  return (
    <AppShell>
      <div className="pt-6">
        <p className="text-xs font-bold uppercase">Shared playlist</p>
        <h1 className="mt-2 text-3xl font-extrabold">{songs.length} songs for you</h1>
        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={() => playContext(songs, 0, "playlist" as never)}
            aria-label="Play shared playlist"
            className="grid h-14 w-14 place-items-center rounded-full transition-transform hover:scale-105"
            style={{ backgroundColor: "var(--color-brand)" }}
          >
            <Play className="h-6 w-6 fill-black text-black" />
          </button>
          <button
            onClick={() => {
              const pl = createPlaylist("Shared playlist");
              songs.forEach((s) => addSongToPlaylist(pl.id, s));
              toast.success("Saved to your library");
            }}
            className="flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" /> Save to Library
          </button>
        </div>
        <ul className="mt-8 flex flex-col">
          {songs.map((song, i) => {
            const active = currentId === song.id;
            return (
              <li
                key={song.id}
                onClick={() => playContext(songs, i, "playlist" as never)}
                className="grid cursor-pointer grid-cols-[24px_40px_1fr] items-center gap-4 rounded-md px-3 py-2 hover:bg-surface-card-hover"
              >
                <span className="text-sm tabular-nums" style={{ color: active ? "var(--color-brand)" : "var(--color-text-secondary)" }}>
                  {i + 1}
                </span>
                <img src={getThumbnail(song)} alt="" className="h-10 w-10 rounded" />
                <div className="min-w-0">
                  <div
                    className="truncate text-sm font-medium"
                    style={{ color: active ? "var(--color-brand)" : "var(--color-foreground)" }}
                    children={decodeEntities(song.name)}
                  />
                  <div className="truncate text-xs" style={{ color: "var(--color-text-secondary)" }}>
                    {getArtistString(song)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </AppShell>
  );
}
