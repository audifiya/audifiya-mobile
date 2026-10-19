import { useState } from "react";
import { Plus, Heart, Check, ListPlus } from "lucide-react";
import { toast } from "sonner";
import {
  addSongToPlaylist,
  createPlaylist,
  toggleLiked,
  useLikedIds,
  usePlaylists,
} from "@/lib/library";
import { usePlayback } from "@/lib/playback-engine";
import type { JSSong } from "@/lib/jiosaavn";


interface Props {
  song: JSSong;
  align?: "left" | "right";
  color?: string;
  size?: number;
}

export function AddToMenu({
  song,
  align = "right",
  color = "var(--color-text-secondary)",
  size = 16,
}: Props) {
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const playlists = usePlaylists();
  const likedIds = useLikedIds();
  const liked = likedIds.has(song.id);

  const handleAdd = (pid: string) => {
    addSongToPlaylist(pid, song);
    setAdded(pid);
    setTimeout(() => {
      setAdded(null);
      setOpen(false);
    }, 700);
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Add to playlist"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-white/10"
        style={{ color, opacity: open ? 1 : undefined }}
      >
        <Plus style={{ width: size, height: size }} />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <div
            className={`absolute bottom-full z-50 mb-2 w-64 overflow-hidden rounded-md py-1 text-sm shadow-2xl ${
              align === "right" ? "right-0" : "left-0"
            }`}
            style={{
              backgroundColor: "#282828",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/10"
              onClick={() => {
                toggleLiked(song);
                setOpen(false);
              }}
            >
              <Heart
                className="h-4 w-4"
                fill={liked ? "currentColor" : "none"}
                style={{ color: liked ? "var(--color-brand)" : undefined }}
              />
              <span>
                {liked ? "Remove from Liked Songs" : "Add to Liked Songs"}
              </span>
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/10"
              onClick={() => {
                usePlayback.getState().playNext(song);
                toast.success("Added to Play Next");
                setOpen(false);
              }}
            >
              <ListPlus className="h-4 w-4" />
              <span>Play Next</span>
            </button>
            <div className="my-1 border-t border-white/5" />

            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
              onClick={() => {
                const name = prompt("Playlist name?");
                if (name) {
                  const pl = createPlaylist(name);
                  handleAdd(pl.id);
                }
              }}
            >
              <span>+ New playlist</span>
            </button>
            {playlists.length > 0 && (
              <div className="my-1 border-t border-white/5" />
            )}
            <div className="max-h-56 overflow-y-auto">
              {playlists.map((p) => {
                const has = p.songs.some((s) => s.id === song.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={has}
                    onClick={() => {
                      if (!has) handleAdd(p.id);
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/10 disabled:opacity-60 disabled:hover:bg-transparent"
                  >
                    <span className="truncate">{p.name}</span>
                    {(added === p.id || has) && (
                      <Check
                        className="h-4 w-4 shrink-0"
                        style={{ color: "var(--color-brand)" }}
                      />
                    )}
                  </button>
                );
              })}
              {playlists.length === 0 && (
                <div
                  className="px-3 py-2 text-xs"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  No playlists yet.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
