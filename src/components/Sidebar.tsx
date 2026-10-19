import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, Library, Plus, Music2, Heart } from "lucide-react";
import { createPlaylist, useLikedIds, usePlaylists } from "@/lib/library";
import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";


export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const playlists = usePlaylists();
  const likedIds = useLikedIds();


  const navItem = (to: string, icon: React.ReactNode, label: string) => {
    const active = pathname === to;
    return (
      <Link
        to={to}
        title={label}
        className="flex items-center gap-4 rounded-md px-3 py-2 text-sm font-semibold transition-colors lg:justify-start justify-center"
        style={{
          color: active
            ? "var(--color-foreground)"
            : "var(--color-text-secondary)",
        }}
      >
        {icon}
        <span className="hidden lg:inline">{label}</span>
      </Link>
    );
  };

  return (
    <aside className="hidden h-full shrink-0 flex-col gap-2 p-2 md:flex md:w-[72px] lg:w-[280px]">
      {/* Nav block */}
      <div
        className="rounded-lg p-2 lg:p-4"
        style={{ backgroundColor: "var(--color-surface-main)" }}
      >
        <div className="mb-4 flex items-center gap-2 px-2 justify-center lg:justify-start">
          <div
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
            style={{ backgroundColor: "var(--color-brand)" }}
          >
            <Music2 className="h-4 w-4" color="#000" />
          </div>
          <div className="hidden lg:block">
            <BrandMark size="md" tagline />
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {navItem("/", <Home className="h-5 w-5" />, "Home")}
          {navItem("/search", <Search className="h-5 w-5" />, "Search")}
        </nav>
        <div className="mt-3 flex items-center justify-center gap-2 px-2 lg:justify-between">
          <span
            className="hidden text-xs font-semibold lg:inline"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Theme
          </span>
          <ThemeToggle />
        </div>
      </div>

      {/* Library block */}
      <div
        className="flex min-h-0 flex-1 flex-col rounded-lg"
        style={{ backgroundColor: "var(--color-surface-main)" }}
      >
        <div className="flex items-center justify-between p-2 lg:p-4 lg:pb-2">
          <div
            className="flex items-center gap-3 text-sm font-semibold justify-center lg:justify-start w-full lg:w-auto"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <Library className="h-5 w-5" />
            <span className="hidden lg:inline">Your Library</span>
          </div>
          <button
            type="button"
            aria-label="Create playlist"
            onClick={() => {
              const name = prompt("Playlist name?");
              if (name !== null) createPlaylist(name);
            }}
            className="hidden lg:grid h-7 w-7 place-items-center rounded-full transition-colors hover:bg-surface-card-hover"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-2 pb-2">
          <Link
            to="/liked"
            title="Liked Songs"
            className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-surface-card-hover justify-center lg:justify-start"
          >
            <div
              className="grid h-11 w-11 shrink-0 place-items-center rounded"
              style={{
                background: "linear-gradient(135deg, #6b1eff 0%, #1e90ff 100%)",
              }}
            >
              <Heart className="h-5 w-5 fill-white text-white" />
            </div>
            <div className="hidden min-w-0 lg:block">
              <div className="truncate text-sm font-medium">Liked Songs</div>
              <div
                className="truncate text-xs"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Playlist · {likedIds.size} songs
              </div>
            </div>
          </Link>
          {playlists.length === 0 ? (
            <div
              className="mx-2 mt-2 hidden rounded-md p-4 text-sm lg:block"
              style={{
                backgroundColor: "var(--color-surface-card)",
                color: "var(--color-text-secondary)",
              }}
            >
              Create your first playlist with the + button.
            </div>
          ) : (

            <ul className="flex flex-col">
              {playlists.map((p) => (
                <li key={p.id}>
                  <Link
                    to="/playlist/$id"
                    params={{ id: p.id }}
                    title={p.name}
                    className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-surface-card-hover justify-center lg:justify-start"
                  >
                    <div
                      className="grid h-11 w-11 shrink-0 place-items-center rounded"
                      style={{
                        backgroundColor: "var(--color-surface-card-hover)",
                      }}
                    >
                      <Music2
                        className="h-5 w-5"
                        style={{ color: "var(--color-text-secondary)" }}
                      />
                    </div>
                    <div className="hidden min-w-0 lg:block">
                      <div className="truncate text-sm font-medium">
                        {p.name}
                      </div>
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
      </div>
    </aside>
  );
}
