import { createFileRoute, Link } from "@tanstack/react-router";
import { Music2, Plus, Heart } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { createPlaylist, usePlaylists, useLikedIds } from "@/lib/library";
import { LayoutToggle } from "@/components/LayoutToggle";
import { useLayoutPref } from "@/lib/layout-pref";
import { ExtensionCard } from "@/components/ExtensionCard";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Your Library — AudiFiya" },
      { name: "description", content: "Your playlists and liked songs." },
      { property: "og:url", content: "https://audifiya.lovable.app/library" },
    ],
    links: [{ rel: "canonical", href: "https://audifiya.lovable.app/library" }],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const playlists = usePlaylists();
  const liked = useLikedIds();
  const [layout, setLayout] = useLayoutPref();

  return (
    <AppShell>
      <div className="pt-4">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-extrabold md:text-3xl">Your Library</h1>
          <div className="flex items-center gap-2">
            <LayoutToggle value={layout} onChange={setLayout} />
            <button
              type="button"
              onClick={() => {
                const name = prompt("Playlist name?");
                if (name !== null) createPlaylist(name);
              }}
              aria-label="Create playlist"
              className="grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-white/10"
              style={{ color: "var(--color-text-secondary)" }}
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        <Link
          to="/liked"
          className="mb-3 flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-surface-card-hover"
          style={{ backgroundColor: "var(--color-surface-card)" }}
        >
          <div
            className="grid h-14 w-14 shrink-0 place-items-center rounded"
            style={{
              background: "linear-gradient(135deg, #6b1eff 0%, #1e90ff 100%)",
            }}
          >
            <Heart className="h-6 w-6 fill-white text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold">Liked Songs</div>
            <div
              className="text-xs"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {liked.size} songs
            </div>
          </div>
        </Link>


        {playlists.length === 0 ? (
          <p
            className="mt-6 text-sm"
            style={{ color: "var(--color-text-secondary)" }}
          >
            No playlists yet. Tap + to create one.
          </p>
        ) : (
          <ul
            className={
              layout === "list"
                ? "flex w-full flex-col gap-2"
                : "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
            }
          >
            {playlists.map((p) => (
              <li key={p.id}>
                <Link
                  to="/playlist/$id"
                  params={{ id: p.id }}
                  className={
                    layout === "list"
                      ? "flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-surface-card-hover"
                      : "flex flex-col gap-3 rounded-lg p-3 transition-colors hover:bg-surface-card-hover"
                  }
                  style={
                    layout === "grid"
                      ? { backgroundColor: "var(--color-surface-card)" }
                      : undefined
                  }
                >
                  <div
                    className={
                      layout === "list"
                        ? "grid h-14 w-14 shrink-0 place-items-center rounded"
                        : "grid aspect-square w-full place-items-center rounded-md"
                    }
                    style={{
                      backgroundColor: "var(--color-surface-card-hover)",
                    }}
                  >
                    <Music2
                      className={layout === "list" ? "h-6 w-6" : "h-10 w-10"}
                      style={{ color: "var(--color-text-secondary)" }}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{p.name}</div>
                    <div
                      className="truncate text-xs"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      Playlist · {p.songs.length} songs
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ExtensionCard />
    </AppShell>
  );
}
