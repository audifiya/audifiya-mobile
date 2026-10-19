import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { SongCard, SongCardSkeleton } from "@/components/SongCard";
import {
  fetchArtistSongs,
  fetchRecommendations,
  fetchSongById,
  fetchTrending,
  getArtistString,
  searchSongs,
} from "@/lib/jiosaavn";
import { useProfile } from "@/lib/user-profile";
import { clearPlaybackHistory, usePlaybackHistory } from "@/lib/library";
import { usePlayback } from "@/lib/playback-engine";
import { decodeEntities } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Home — AudiFiya" },
      {
        name: "description",
        content:
          "Trending tracks, fresh recommendations and everything you played recently.",
      },
      { property: "og:title", content: "Home — AudiFiya" },
      {
        property: "og:description",
        content:
          "Trending tracks, fresh recommendations and everything you played recently.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://audifiya.lovable.app/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://audifiya.lovable.app/" }],
  }),
  component: Home,
});

function Scroller({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex w-full snap-x snap-mandatory gap-4 overflow-x-auto pb-4 no-scrollbar"
      style={{ scrollBehavior: "smooth" }}
    >
      {children}
    </div>
  );
}

function CardSlot({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-[160px] min-w-[160px] shrink-0 snap-start md:w-[180px] md:min-w-[180px]">
      {children}
    </div>
  );
}

function RowSkeleton() {
  return (
    <Scroller>
      {Array.from({ length: 8 }).map((_, i) => (
        <CardSlot key={i}>
          <SongCardSkeleton />
        </CardSlot>
      ))}
    </Scroller>
  );
}

function Home() {
  const { profile, hydrated } = useProfile();
  const languages = profile?.languages ?? ["english"];
  const enabled = hydrated && !!profile;
  const history = usePlaybackHistory();
  const seed = history[0];

  const trending = useQuery({
    queryKey: ["trending", languages.join(",")],
    queryFn: () => fetchTrending(languages),
    enabled,
    staleTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
  });

  const favArtist = profile?.artists?.[0];

  const recommended = useQuery({
    queryKey: [
      "recommended",
      seed?.id ?? favArtist?.id ?? "none",
      languages.join(","),
    ],
    queryFn: async () => {
      // Listening history wins; brand-new users get their onboarding artist.
      if (seed) {
        const recs = await fetchRecommendations(
          seed.id,
          getArtistString(seed),
        );
        if (recs.length) return recs;
      } else if (favArtist) {
        const songs = await fetchArtistSongs(favArtist.id, favArtist.name);
        if (songs.length) return songs;
      }
      return fetchTrending(["hindi", ...languages]);
    },
    enabled,
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  // History records are lightweight (no stream URLs) — resolve before playing.
  const playHistory = async (idx: number) => {
    const item = history[idx];
    if (!item) return;
    const full =
      (await fetchSongById(item.id)) ??
      (await searchSongs(item.name.replace(/<[^>]+>/g, "")).then(
        (r) => r.find((s) => s.id === item.id) ?? r[0] ?? null,
      ));
    if (!full) {
      toast.error("Couldn't load that track");
      return;
    }
    usePlayback.getState().playContext([full], 0, "search");
  };

  return (
    <AppShell>
      <section className="pt-4">
        <div className="mb-6 flex items-baseline justify-between">
          <h1 className="text-2xl font-extrabold md:text-3xl">
            {profile ? `Good vibes, ${profile.username}` : "Trending now"}
          </h1>
        </div>

        <h2 className="mb-4 text-lg font-bold md:text-xl">Trending songs</h2>

        {trending.isError && (
          <div
            className="rounded-lg p-6 text-sm"
            style={{
              backgroundColor: "var(--color-surface-card)",
              color: "var(--color-text-secondary)",
            }}
          >
            <p className="mb-3">Couldn't reach the music service.</p>
            <button
              onClick={() => trending.refetch()}
              className="rounded-full px-4 py-2 text-sm font-bold"
              style={{ backgroundColor: "var(--color-brand)", color: "#000" }}
            >
              Retry connection
            </button>
          </div>
        )}

        {(trending.isLoading || !enabled) && <RowSkeleton />}

        {trending.data && trending.data.length > 0 && (
          <Scroller>
            {trending.data.map((song, i) => (
              <CardSlot key={song.id}>
                <SongCard song={song} context={trending.data!} index={i} />
              </CardSlot>
            ))}
          </Scroller>
        )}

        {enabled && (recommended.isLoading || (recommended.data?.length ?? 0) > 0) && (
          <>
            <h2 className="mb-4 mt-8 text-lg font-bold md:text-xl">
              Recommended for you
            </h2>
            {recommended.isLoading ? (
              <RowSkeleton />
            ) : (
              <Scroller>
                {recommended.data!.map((song, i) => (
                  <CardSlot key={`rec-${song.id}-${i}`}>
                    <SongCard
                      song={song}
                      context={recommended.data!}
                      index={i}
                    />
                  </CardSlot>
                ))}
              </Scroller>
            )}
          </>
        )}

        {history.length > 0 && (
          <>
            <div className="mb-4 mt-8 flex items-center justify-between">
              <h2 className="text-lg font-bold md:text-xl">Recently played</h2>
              <button
                type="button"
                onClick={() => clearPlaybackHistory()}
                className="text-xs font-semibold hover:underline"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Clear
              </button>
            </div>
            <Scroller>
              {history.map((song, i) => (
                <CardSlot key={`hist-${song.id}`}>
                  <button
                    type="button"
                    onClick={() => playHistory(i)}
                    className="group flex w-full flex-col gap-3 rounded-lg p-3 text-left transition-colors hover:bg-surface-card-hover md:p-4"
                    style={{ backgroundColor: "var(--color-surface-card)" }}
                  >
                    <img
                      src={
                        song.image?.[song.image.length - 1]?.url ?? undefined
                      }
                      alt=""
                      loading="lazy"
                      className="aspect-square w-full rounded-md object-cover"
                    />
                    <span
                      className="truncate text-sm font-semibold"
                      children={decodeEntities(song.name)}
                    />
                  </button>
                </CardSlot>
              ))}
            </Scroller>
          </>
        )}
      </section>
    </AppShell>
  );
}
