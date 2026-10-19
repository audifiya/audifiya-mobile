// JioSaavn API helpers — all client-side, no auth needed.

const BASE = "https://jiosavan-api2.vercel.app/api";

export interface JSImage {
  quality: string;
  url: string;
}
export interface JSDownloadUrl {
  quality: string;
  url: string;
}
export interface JSArtist {
  id: string;
  name: string;
  image?: JSImage[];
}
export interface JSSong {
  id: string;
  name: string;
  duration?: number;
  image: JSImage[];
  downloadUrl: JSDownloadUrl[];
  artists?: { primary?: JSArtist[]; all?: JSArtist[] };
  album?: { name?: string };
}

const GENERIC_ART =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 500 500'><rect width='500' height='500' fill='#242424'/><circle cx='250' cy='250' r='100' fill='none' stroke='#6a6a6a' stroke-width='8'/><circle cx='250' cy='250' r='16' fill='#6a6a6a'/></svg>`,
  );

export function getThumbnail(song?: JSSong | null): string {
  if (!song?.image?.length) return GENERIC_ART;
  const last = song.image[song.image.length - 1];
  return last?.url || GENERIC_ART;
}

export function getStreamUrl(song?: JSSong | null): string | null {
  if (!song?.downloadUrl?.length) return null;
  const hq = song.downloadUrl.find((d) => d.quality === "320kbps");
  return (hq ?? song.downloadUrl[0])?.url ?? null;
}

export function getArtistString(song?: JSSong | null): string {
  const list = song?.artists?.primary ?? song?.artists?.all ?? [];
  return list.map((a) => a.name).join(", ") || "Unknown artist";
}

export function getPrimaryArtist(
  song?: JSSong | null,
): { id: string | null; name: string; imageUrl: string | null } | null {
  const list = song?.artists?.primary ?? song?.artists?.all ?? [];
  const a = list[0];
  if (!a) return null;
  const img = a.image?.length ? a.image[a.image.length - 1]?.url ?? null : null;
  return { id: a.id ?? null, name: a.name, imageUrl: img };
}

export async function fetchTrending(languages: string[]): Promise<JSSong[]> {
  const lang = languages.join(",") || "english";
  try {
    const res = await fetch(
      `${BASE}/modules?language=${encodeURIComponent(lang)}&_t=${Date.now()}`,
    );
    if (res.ok) {
      const json = await res.json();
      const songs: JSSong[] = json?.data?.trending?.songs ?? [];
      if (songs.length > 0) return songs;
    }
  } catch {
    /* fall through to search fallback */
  }
  for (const q of ["latest", "trending", "top hits"]) {
    try {
      const songs = await searchSongs(q);
      if (songs.length > 0) return songs.slice(0, 15);
    } catch {
      /* try next */
    }
  }
  return [];
}

export async function fetchAlbums(languages: string[]): Promise<
  Array<{ id: string; name: string; image: JSImage[]; songs?: JSSong[] }>
> {
  const lang = languages.join(",") || "english";
  const res = await fetch(
    `${BASE}/modules?language=${encodeURIComponent(lang)}`,
  );
  if (!res.ok) return [];
  const json = await res.json();
  return json?.data?.albums ?? [];
}

export async function searchSongs(query: string): Promise<JSSong[]> {
  if (!query.trim()) return [];
  const res = await fetch(
    `${BASE}/search/songs?query=${encodeURIComponent(query)}&limit=40`,
  );
  if (!res.ok) throw new Error("Search failed");
  const json = await res.json();
  return json?.data?.results ?? [];
}

export interface JSArtistResult {
  id: string;
  name: string;
  imageUrl?: string;
  role?: string;
}

export async function searchArtists(query: string): Promise<JSArtistResult[]> {
  if (!query.trim()) return [];
  try {
    const res = await fetch(
      `${BASE}/search/artists?query=${encodeURIComponent(query)}&limit=30`,
    );
    if (!res.ok) return [];
    const json = await res.json();
    const results: any[] = json?.data?.results ?? [];
    return results
      .filter((a) => a?.id && a?.name)
      .map((a) => ({
        id: String(a.id),
        name: String(a.name),
        role: a.role,
        imageUrl:
          Array.isArray(a.image) && a.image.length
            ? (a.image[a.image.length - 1]?.url ?? a.image[a.image.length - 1]?.link)
            : typeof a.image === "string"
              ? a.image
              : undefined,
      }));
  } catch {
    return [];
  }
}

export interface JSArtistDetails {
  id: string;
  name: string;
  image?: JSImage[];
  isVerified?: boolean;
  followerCount?: number;
}

export async function fetchArtistDetails(
  artistId: string,
): Promise<JSArtistDetails | null> {
  try {
    const res = await fetch(`${BASE}/artists/${encodeURIComponent(artistId)}`);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}

export async function fetchArtistSongs(
  artistId: string,
  fallbackName: string,
): Promise<JSSong[]> {
  try {
    const res = await fetch(
      `${BASE}/artists/${encodeURIComponent(artistId)}/songs?limit=20&sortBy=popularity`,
    );
    if (res.ok) {
      const json = await res.json();
      const songs: JSSong[] = json?.data?.songs ?? json?.data?.results ?? [];
      if (songs.length) return songs;
    }
  } catch {
    /* fall through */
  }
  if (fallbackName) {
    try {
      const s = await searchSongs(fallbackName);
      return s.slice(0, 20);
    } catch {
      /* noop */
    }
  }
  return [];
}

export async function fetchSongById(id: string): Promise<JSSong | null> {
  try {
    const res = await fetch(`${BASE}/songs/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data;
    const song: JSSong | undefined = Array.isArray(data) ? data[0] : data;
    return song?.id ? song : null;
  } catch {
    return null;
  }
}

/** Songs similar to the given track — powers "song radio" autoplay. */
export async function fetchRecommendations(
  songId: string,
  fallbackArtist?: string,
): Promise<JSSong[]> {
  try {
    const res = await fetch(
      `${BASE}/songs/${encodeURIComponent(songId)}/suggestions?limit=20`,
    );
    if (res.ok) {
      const json = await res.json();
      const songs: JSSong[] = json?.data ?? json?.data?.songs ?? [];
      if (Array.isArray(songs) && songs.length) return songs;
    }
  } catch {
    /* fall through */
  }
  try {
    const res = await fetch(
      `${BASE}/songs/${encodeURIComponent(songId)}/recommendations?limit=20`,
    );
    if (res.ok) {
      const json = await res.json();
      const songs: JSSong[] = Array.isArray(json?.data)
        ? json.data
        : (json?.data?.songs ?? json?.data?.results ?? []);
      if (Array.isArray(songs) && songs.length) return songs;
    }
  } catch {
    /* fall through */
  }
  if (fallbackArtist) {
    try {
      const s = await searchSongs(fallbackArtist);
      return s.filter((t) => t.id !== songId).slice(0, 20);
    } catch {
      /* noop */
    }
  }
  return [];
}

/** Hydrate many songs by ID, preserving order; falls back per-ID. */
export async function fetchSongsByIds(ids: string[]): Promise<JSSong[]> {
  const map = new Map<string, JSSong>();
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    try {
      const res = await fetch(`${BASE}/songs?ids=${encodeURIComponent(chunk.join(","))}`);
      if (res.ok) {
        const json = await res.json();
        const list: JSSong[] = Array.isArray(json?.data) ? json.data : [];
        for (const s of list) if (s?.id) map.set(s.id, s);
      }
    } catch {
      /* fall back below */
    }
  }
  const missing = ids.filter((id) => !map.has(id));
  const filled = await Promise.all(missing.map((id) => fetchSongById(id)));
  filled.forEach((s) => s && map.set(s.id, s));
  return ids.map((id) => map.get(id)).filter((s): s is JSSong => !!s);
}

/** Convert JioSaavn's HTML-ish lyrics (`<br>` line breaks) into plain text. */
export function parseSaavnLyrics(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
  return text || null;
}

export async function fetchSaavnLyrics(id: string, signal?: AbortSignal): Promise<string | null> {
  const res = await fetch(`${BASE}/songs/${encodeURIComponent(id)}/lyrics`, { signal });
  if (!res.ok) return null;
  const json = await res.json();
  return parseSaavnLyrics(json?.data?.lyrics);
}
