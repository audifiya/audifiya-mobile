import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Play, Heart } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ArtistTag } from "@/components/ArtistTag";
import { AddToMenu } from "@/components/AddToMenu";
import { getThumbnail } from "@/lib/jiosaavn";
import { readLiked, toggleLiked } from "@/lib/library";
import { formatTime, usePlayback } from "@/lib/playback-engine";
import type { JSSong } from "@/lib/jiosaavn";
import { useProfile } from "@/lib/user-profile";
import { LayoutToggle, layoutContainerClass } from "@/components/LayoutToggle";
import { useLayoutPref } from "@/lib/layout-pref";
import { SongCard } from "@/components/SongCard";

export const Route = createFileRoute("/liked")({
  head: () => ({
    meta: [
      { title: "Liked Songs — AudiFiya" },
      { name: "description", content: "All the tracks you've liked." },
      { property: "og:url", content: "https://audifiya.lovable.app/liked" },
    ],
    links: [{ rel: "canonical", href: "https://audifiya.lovable.app/liked" }],
  }),
  component: LikedPage,
});

function LikedPage() {
  const [songs, setSongs] = useState<JSSong[]>([]);
  const playContext = usePlayback((s) => s.playContext);
  const { profile } = useProfile();
  const [layout, setLayout] = useLayoutPref();

  useEffect(() => {
    const sync = () => setSongs(readLiked());
    sync();
    window.addEventListener("app-liked-changed", sync);
    return () => window.removeEventListener("app-liked-changed", sync);
  }, []);

  return (
    <AppShell>
      <div className="flex items-end gap-6 pt-6">
        <div
          className="grid h-48 w-48 shrink-0 place-items-center rounded-lg shadow-xl"
          style={{
            background: "linear-gradient(135deg, #6b1eff 0%, #1e90ff 100%)",
          }}
        >
          <Heart className="h-20 w-20 fill-white text-white" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase">Playlist</p>
          <h1 className="mt-2 text-5xl font-extrabold">Liked Songs</h1>
          <p
            className="mt-4 text-sm"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {profile?.username ? `${profile.username} · ` : ""}
            {songs.length} songs
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          disabled={songs.length === 0}
          onClick={() => playContext(songs, 0)}
          aria-label="Play all liked songs"
          className="grid h-14 w-14 place-items-center rounded-full transition-transform hover:scale-105 disabled:opacity-40"
          style={{ backgroundColor: "var(--color-brand)" }}
        >
          <Play className="h-6 w-6 fill-black text-black" />
        </button>
      </div>

      <div className="mt-8">
        {songs.length === 0 ? (
          <p style={{ color: "var(--color-text-secondary)" }}>
            Songs you like will appear here. Tap the heart on any track to save it.
          </p>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Songs</h2>
              <LayoutToggle value={layout} onChange={setLayout} />
            </div>
            <div className={layoutContainerClass(layout)}>
              {songs.map((song, i) => (
                <SongCard
                  key={song.id}
                  song={song}
                  context={songs}
                  index={i}
                  variant={layout}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
