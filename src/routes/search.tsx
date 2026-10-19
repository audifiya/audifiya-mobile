import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search as SearchIcon, X, Clock, Play, Mic } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { SearchRowCard, HorizontalRow } from "@/components/SearchRowCard";
import { ArtistTag } from "@/components/ArtistTag";
import {
  fetchRecommendations,
  getThumbnail,
  searchArtists,
  searchSongs,
  type JSSong,
} from "@/lib/jiosaavn";
import { useArtistView } from "@/lib/artist-view";
import { usePlayback } from "@/lib/playback-engine";
import {
  clearPlaybackHistory,
  pushSearchHistory,
  removePlaybackHistoryItem,
  removeSearchHistory,
  usePlaybackHistory,
  useSearchHistory,
} from "@/lib/library";
import { decodeEntities } from "@/lib/utils";
import { useThemeMode } from "@/lib/theme-mode";
import { searchByLyrics } from "@/lib/lyrics";
import {
  createRecognizer,
  isSpeechSupported,
  parseVoiceCommand,
  type Recognizer,
} from "@/lib/speech";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search — AudiFiya" },
      { name: "description", content: "Find any song by title or artist." },
      { property: "og:url", content: "https://audifiya.lovable.app/search" },
    ],
    links: [{ rel: "canonical", href: "https://audifiya.lovable.app/search" }],
  }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const { liquid, light } = useThemeMode();
  const [debounced, setDebounced] = useState("");
  const [focused, setFocused] = useState(false);
  const [listening, setListening] = useState(false);
  const [mode, setMode] = useState<"songs" | "artists">("songs");
  const [searchBy, setSearchBy] = useState<"titles" | "lyrics">("titles");
  const openArtist = useArtistView((s) => s.openArtist);
  const history = useSearchHistory();
  const playback = usePlaybackHistory();
  const playContext = usePlayback((s) => s.playContext);
  const speechSupported = useMemo(() => isSpeechSupported(), []);
  const recRef = useRef<Recognizer | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    return () => recRef.current?.stop();
  }, []);

  const query = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => searchSongs(debounced),
    enabled: debounced.length > 0 && mode === "songs" && searchBy === "titles",
  });

  const lyricQuery = useQuery({
    queryKey: ["search-lyrics", debounced],
    queryFn: () => searchByLyrics(debounced),
    enabled: debounced.length >= 3 && mode === "songs" && searchBy === "lyrics",
    staleTime: 10 * 60 * 1000,
  });
  const lyricsMode = mode === "songs" && searchBy === "lyrics";

  const artistQuery = useQuery({
    queryKey: ["search-artists", debounced],
    queryFn: () => searchArtists(debounced),
    enabled: debounced.length > 0 && mode === "artists",
  });

  const topSong = query.data?.[0];
  const similar = useQuery({
    queryKey: ["search-similar", topSong?.id],
    queryFn: () =>
      fetchRecommendations(topSong!.id, topSong!.artists?.primary?.[0]?.name),
    enabled: !!topSong && mode === "songs" && searchBy === "titles",
    staleTime: 60 * 60 * 1000,
  });

  const commitSearch = () => {
    const term = q.trim();
    if (term) pushSearchHistory(term);
  };

  const isIdle = !debounced;
  const showHistory = (isIdle || focused) && history.length > 0 && !q;
  const showRecent = isIdle && playback.length > 0;


  // History records are stored lightweight (no stream URLs) — re-resolve on demand.
  const playHistory = async (idx: number) => {
    const item = playback[idx];
    if (!item) return;
    if (item.downloadUrl?.length) {
      playContext([item], 0, "search");
      return;
    }
    const title = item.name.replace(/<[^>]+>/g, "");
    const results = await searchSongs(title);
    const hit = results.find((s) => s.id === item.id) ?? results[0];
    if (hit) playContext([hit], 0, "search");
    else toast.error("Couldn't load that track");
  };

  const handleVoiceTranscript = async (transcript: string) => {
    const cmd = parseVoiceCommand(transcript);
    const pb = usePlayback.getState();
    if (cmd.kind === "pause") {
      if (pb.isPlaying) pb.togglePlay();
      toast("Paused");
      return;
    }
    if (cmd.kind === "play") {
      if (!pb.isPlaying && pb.currentTrack) pb.togglePlay();
      toast("Playing");
      return;
    }
    const term = (cmd.query ?? "").trim();
    if (!term) return;
    setQ(term);
    if (cmd.kind === "search") {
      try {
        toast(`Searching “${term}”…`);
        const results = await searchSongs(term);
        if (results.length > 0) {
          playContext(results, 0, "search");
          toast(`Now playing: ${results[0].name.replace(/<[^>]+>/g, "")}`);
        } else {
          toast("No results found");
        }
      } catch {
        toast("Search failed");
      }
    }
  };

  const startVoice = () => {
    if (!speechSupported || listening) return;
    const rec = createRecognizer({
      onResult: (t) => handleVoiceTranscript(t),
      onEnd: () => setListening(false),
      onError: () => {
        setListening(false);
        toast("Mic error — try again");
      },
    });
    if (!rec) return;
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  const stopVoice = () => {
    recRef.current?.stop();
    setListening(false);
  };



  return (
    <AppShell>
      <div className="pt-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            commitSearch();
          }}
          className={`mb-6 flex h-12 items-center gap-3 rounded-full px-4 transition-all duration-300 ${
            liquid
              ? light
                ? "border border-black/5 bg-white/60 shadow-[0_4px_16px_rgba(0,0,0,0.05)] backdrop-blur-xl focus-within:bg-white/80"
                : "border border-white/15 bg-white/10 shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] backdrop-blur-xl focus-within:bg-white/15"
              : ""
          }`}
          style={
            liquid ? undefined : { backgroundColor: "var(--color-surface-card)" }
          }
        >
          <button
            type="submit"
            aria-label="Search"
            className="grid h-5 w-5 shrink-0 place-items-center"
          >
            <SearchIcon
              className="h-5 w-5"
              style={{ color: "var(--color-text-secondary)" }}
            />
          </button>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitSearch();
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder={listening ? "Listening…" : lyricsMode ? "Type a line from the song…" : "What do you want to listen to?"}
            className="w-full bg-transparent text-sm outline-none placeholder:text-text-muted"
            autoFocus
          />
          {mode === "songs" && (
            <div role="group" aria-label="Search by" className="flex shrink-0 items-center rounded-full bg-accent p-0.5 text-xs font-semibold">
              {(["titles", "lyrics"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={searchBy === v}
                  onClick={() => setSearchBy(v)}
                  className={`rounded-full px-3 py-1 capitalize transition-colors ${
                    searchBy === v ? "bg-foreground text-background" : "text-text-secondary"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
          {speechSupported && (
            <button
              type="button"
              onClick={listening ? stopVoice : startVoice}
              aria-label={listening ? "Stop listening" : "Voice search"}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-white/10"
              style={{
                color: listening ? "#ef4444" : "var(--color-text-secondary)",
              }}
            >
              <Mic
                className={`h-4 w-4 ${listening ? "animate-pulse" : ""}`}
                fill={listening ? "currentColor" : "none"}
              />
            </button>
          )}
        </form>

        <div className="mb-6 flex items-center gap-2">
          {(["songs", "artists"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition-colors ${
                liquid && mode !== m
                  ? light
                    ? "border border-black/5 bg-white/50 shadow-sm backdrop-blur-md hover:bg-white/80"
                    : "border border-white/10 bg-white/5 shadow-sm backdrop-blur-md hover:bg-white/15"
                  : ""
              }`}
              style={
                liquid && mode !== m
                  ? undefined
                  : {
                      backgroundColor:
                        mode === m
                          ? "var(--color-foreground)"
                          : "var(--color-surface-card)",
                      color: mode === m ? "var(--color-background)" : "inherit",
                    }
              }
            >
              {m}
            </button>
          ))}
        </div>

        {showRecent && (
          <div className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Recently played</h2>
              <button
                type="button"
                onClick={() => clearPlaybackHistory()}
                className="text-xs font-semibold hover:underline"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Clear
              </button>
            </div>
            <ul className="flex flex-col gap-1">
              {playback.map((song, i) => (
                <li
                  key={song.id}
                  className="group flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-surface-card-hover"
                >
                  <button
                    type="button"
                    onClick={() => playHistory(i)}
                    className="relative shrink-0"
                    aria-label={`Play ${song.name}`}
                  >
                    <img
                      src={getThumbnail(song)}
                      alt=""
                      className="h-12 w-12 rounded object-cover"
                    />
                    <span className="absolute inset-0 grid place-items-center rounded bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      <Play className="h-5 w-5 fill-white text-white" />
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => playHistory(i)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div
                      className="truncate text-sm font-medium"
                      children={decodeEntities(song.name)}
                    />
                    <div
                      className="mt-0.5 truncate text-xs"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      <ArtistTag song={song} />
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label="Remove from recently played"
                    onClick={() => removePlaybackHistoryItem(song.id)}
                    className="grid h-7 w-7 place-items-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/10"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {showHistory && (
          <div className="mb-8">
            <h2 className="mb-3 text-lg font-bold">Recent searches</h2>
            <ul className="flex flex-col gap-1">
              {history.map((item) => (
                <li
                  key={item}
                  className="group flex items-center justify-between rounded-md px-2 py-2 hover:bg-surface-card-hover"
                >
                  <button
                    type="button"
                    onClick={() => setQ(item)}
                    className="flex flex-1 items-center gap-3 text-left text-sm"
                  >
                    <Clock
                      className="h-4 w-4"
                      style={{ color: "var(--color-text-secondary)" }}
                    />
                    <span>{item}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove "${item}" from recent searches`}
                    onClick={() => removeSearchHistory(item)}
                    className="grid h-7 w-7 place-items-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/10"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isIdle && !showHistory && !showRecent && (
          <p style={{ color: "var(--color-text-secondary)" }}>
            Type to search millions of songs.
          </p>
        )}

        {lyricsMode && debounced.length >= 3 && lyricQuery.isFetching && (
          <div className="mb-4 flex items-center gap-2 text-sm text-text-secondary" role="status">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Finding songs with that line…
          </div>
        )}
        {lyricsMode && lyricQuery.data && lyricQuery.data.length > 0 && !lyricQuery.isFetching && (
          <>
            <h2 className="mb-3 text-lg font-bold">Songs with that line</h2>
            <HorizontalRow>
              {lyricQuery.data.map((song) => (
                <SearchRowCard key={song.id} song={song} />
              ))}
            </HorizontalRow>
          </>
        )}
        {lyricsMode && lyricQuery.data && lyricQuery.data.length === 0 && !lyricQuery.isFetching && (
          <p className="text-text-secondary">
            No songs found with that line. Try another line, or switch to Titles.
          </p>
        )}

        {mode === "songs" && !lyricsMode && query.isLoading && debounced && (
          <HorizontalRow>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-[196px] w-[140px] flex-none" />
            ))}
          </HorizontalRow>
        )}

        {mode === "songs" && !lyricsMode && query.data && query.data.length > 0 && (
          <>
            <h2 className="mb-3 text-lg font-bold">Songs</h2>
            <HorizontalRow>
              {query.data.map((song) => (
                <SearchRowCard key={song.id} song={song} />
              ))}
            </HorizontalRow>
            {similar.data && similar.data.length > 0 && (
              <>
                <h2 className="mb-3 mt-4 text-lg font-bold">Similar to your search</h2>
                <HorizontalRow>
                  {similar.data.map((song) => (
                    <SearchRowCard key={song.id} song={song} />
                  ))}
                </HorizontalRow>
              </>
            )}
          </>
        )}

        {mode === "artists" && artistQuery.isLoading && debounced && (
          <p style={{ color: "var(--color-text-secondary)" }}>Searching…</p>
        )}

        {mode === "artists" && artistQuery.data && artistQuery.data.length > 0 && (
          <div className="grid grid-cols-3 gap-4 md:grid-cols-5 lg:grid-cols-7">
            {artistQuery.data.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => openArtist(a.id, a.name)}
                className="flex flex-col items-center gap-2 rounded-lg p-3 transition-colors hover:bg-surface-card-hover"
              >
                <img
                  src={a.imageUrl}
                  alt={a.name}
                  loading="lazy"
                  className="aspect-square w-full rounded-full object-cover"
                  style={{ backgroundColor: "var(--color-surface-card-hover)" }}
                />
                <span className="line-clamp-2 text-center text-sm font-medium">
                  {a.name}
                </span>
              </button>
            ))}
          </div>
        )}

        {mode === "artists" && artistQuery.data && artistQuery.data.length === 0 && debounced && (
          <p style={{ color: "var(--color-text-secondary)" }}>
            No artists found for "{debounced}".
          </p>
        )}

        {mode === "songs" && !lyricsMode && query.data && query.data.length === 0 && debounced && (
          <p style={{ color: "var(--color-text-secondary)" }}>
            No results for "{debounced}".
          </p>
        )}
      </div>
    </AppShell>
  );
}
