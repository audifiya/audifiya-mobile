import { Play, MoreHorizontal, Check, Heart, ListPlus } from "lucide-react";
import { toast } from "sonner";

import { useState } from "react";
import { getThumbnail, type JSSong } from "@/lib/jiosaavn";
import { formatTime, usePlayback, type PlaySource } from "@/lib/playback-engine";
import {
  addSongToPlaylist,
  createPlaylist,
  toggleLiked,
  useLikedIds,
  usePlaylists,
} from "@/lib/library";
import { ArtistTag } from "@/components/ArtistTag";
import { SaveButton } from "@/components/SaveButton";
import { decodeEntities } from "@/lib/utils";

interface Props {
  song: JSSong;
  context: JSSong[];
  index: number;
  source?: PlaySource;
  variant?: "grid" | "list";
}

export function SongCard({
  song,
  context,
  index,
  source,
  variant = "grid",
}: Props) {
  const playContext = usePlayback((s) => s.playContext);
  const currentId = usePlayback((s) => s.currentTrack?.id);
  const isActive = currentId === song.id;
  const playlists = usePlaylists();
  const likedIds = useLikedIds();
  const liked = likedIds.has(song.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [addedTo, setAddedTo] = useState<string | null>(null);

  const handleAdd = (pid: string) => {
    addSongToPlaylist(pid, song);
    setAddedTo(pid);
    setTimeout(() => {
      setMenuOpen(false);
      setShowPlaylistPicker(false);
      setAddedTo(null);
    }, 700);
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setShowPlaylistPicker(false);
  };

  const play = () => playContext(context, index, source);

  const controls = (
    <div className="relative flex items-center gap-1">
      <SaveButton song={song} size={14} />
      {currentId && currentId !== song.id && (
        <button
          type="button"
          aria-label="Play next"
          onClick={(e) => {
            e.stopPropagation();
            usePlayback.getState().playNext(song);
            toast.success(`Queued next: ${song.name.replace(/<[^>]+>/g, "")}`);
          }}
          className="grid h-7 w-7 place-items-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/10"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <ListPlus className="h-4 w-4" />
        </button>
      )}
      <button
        type="button"
        aria-label="More options"
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((o) => !o);
          setShowPlaylistPicker(false);
        }}
        className="grid h-7 w-7 place-items-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/10"
        style={{
          color: "var(--color-text-secondary)",
          opacity: menuOpen ? 1 : undefined,
        }}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              closeMenu();
            }}
          />
          <div
            className="absolute right-0 top-full z-50 mt-1 w-60 overflow-hidden rounded-md py-1 text-sm shadow-2xl"
            style={{
              backgroundColor: "#282828",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {!showPlaylistPicker ? (
              <>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLiked(song);
                    closeMenu();
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
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-white/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPlaylistPicker(true);
                  }}
                >
                  <span>Add to Playlist…</span>
                  <span className="opacity-60">›</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                  onClick={(e) => {
                    e.stopPropagation();
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
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!has) handleAdd(p.id);
                        }}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/10 disabled:opacity-60 disabled:hover:bg-transparent"
                      >
                        <span className="truncate">{p.name}</span>
                        {(addedTo === p.id || has) && (
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
              </>
            )}
          </div>
        </>
      )}
    </div>
  );

  const title = (
    <div
      className="truncate text-sm font-semibold"
      style={{
        color: isActive ? "var(--color-brand)" : "var(--color-foreground)",
      }}
      children={decodeEntities(song.name)}
    />
  );

  if (variant === "list") {
    return (
      <div
        className="group flex w-full cursor-pointer items-center gap-3 rounded-md p-2 transition-colors hover:bg-surface-card-hover"
        onClick={play}
      >
        <div className="relative h-12 w-12 min-w-[48px] shrink-0 overflow-hidden rounded">
          <img
            src={getThumbnail(song)}
            alt={song.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
          <span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            <Play className="h-5 w-5 fill-white text-white" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          {title}
          <div
            className="mt-0.5 truncate text-xs"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <ArtistTag song={song} />
          </div>
        </div>
        <span
          className="hidden text-xs tabular-nums sm:block"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {formatTime(song.duration ?? 0)}
        </span>
        <div onClick={(e) => e.stopPropagation()}>{controls}</div>
      </div>
    );
  }

  return (
    <div
      className="group relative flex w-full cursor-pointer flex-col gap-3 rounded-lg p-3 transition-colors md:p-4"
      style={{ backgroundColor: "var(--color-surface-card)" }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.backgroundColor =
          "var(--color-surface-card-hover)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.backgroundColor = "var(--color-surface-card)")
      }
      onClick={play}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-md bg-surface-card-hover">
        <img
          src={getThumbnail(song)}
          alt={song.name}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            play();
          }}
          aria-label="Play"
          className="absolute bottom-2 right-2 grid h-12 w-12 translate-y-2 place-items-center rounded-full opacity-0 shadow-lg transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 hover:scale-105"
          style={{ backgroundColor: "var(--color-brand)" }}
        >
          <Play className="h-5 w-5 fill-black text-black" />
        </button>
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {title}
          <div
            className="mt-1 truncate text-xs"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <ArtistTag song={song} />
          </div>
        </div>
        {controls}
      </div>
    </div>
  );
}

export function SongCardSkeleton() {
  return (
    <div
      className="flex w-full flex-col gap-3 rounded-lg p-3 md:p-4"
      style={{ backgroundColor: "var(--color-surface-card)" }}
    >
      <div className="skeleton aspect-square w-full" />
      <div className="skeleton h-3 w-3/4" />
      <div className="skeleton h-3 w-1/2" />
    </div>
  );
}
