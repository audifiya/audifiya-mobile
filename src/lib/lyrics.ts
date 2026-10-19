import { useQuery } from "@tanstack/react-query";
import type { JSSong } from "./jiosaavn";
import { fetchSaavnLyrics, getArtistString, searchSongs } from "./jiosaavn";

export interface LyricLine {
  time: number;
  text: string;
}

export function parseLRC(text: string): LyricLine[] {
  if (!text) return [];
  const lines: LyricLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const stamps: number[] = [];
    let m: RegExpExecArray | null;
    const stampRe = /\[(\d+):(\d+)(?:\.(\d+))?\]/g;
    while ((m = stampRe.exec(raw))) {
      const mm = parseInt(m[1], 10);
      const ss = parseInt(m[2], 10);
      const cs = m[3] ? parseInt(m[3].padEnd(3, "0").slice(0, 3), 10) / 1000 : 0;
      stamps.push(mm * 60 + ss + cs);
    }
    if (!stamps.length) continue;
    const content = raw
      .replace(stampRe, "")
      .replace(/<\d+:\d+(?:\.\d+)?>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    for (const t of stamps) lines.push({ time: t, text: content });
  }
  return lines.sort((a, b) => a.time - b.time);
}

export function findActiveIndex(lines: LyricLine[], t: number): number {
  if (!lines.length) return -1;
  let lo = 0, hi = lines.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].time <= t) { ans = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return ans;
}

export type LyricsSource = "lrc.red" | "JioSaavn";

export interface LyricsData {
  synced: LyricLine[] | null;
  plain: string | null;
  source: LyricsSource | null;
}

const LRCRED = "https://lrc.red";
const TIMEOUT_MS = 5000;

function timeoutSignal() {
  return typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
    ? AbortSignal.timeout(TIMEOUT_MS)
    : undefined;
}

export interface LrcRedHit {
  isrc: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  line?: string;
}

/** Undocumented lrc.red search (same endpoint its web app uses). Never throws. */
export async function lrcRedSearch(q: string, inLyrics = false): Promise<LrcRedHit[]> {
  try {
    const qs = new URLSearchParams({ q: q.trim() });
    if (inLyrics) qs.set("in", "lyrics");
    const res = await fetch(`${LRCRED}/search.json?${qs}`, { signal: timeoutSignal() });
    if (!res.ok) return [];
    const j = await res.json();
    return Array.isArray(j?.hits) ? (j.hits as LrcRedHit[]).filter((h) => h?.isrc) : [];
  } catch {
    return [];
  }
}

/** Pick the hit whose duration is closest (within 10s) to the track; else first hit. */
export function pickBestHit(hits: LrcRedHit[], duration?: number): LrcRedHit | null {
  if (!hits.length) return null;
  if (!duration) return hits[0];
  let best: LrcRedHit | null = null;
  let bestDiff = Infinity;
  for (const h of hits) {
    if (typeof h.duration !== "number") continue;
    const d = Math.abs(h.duration - duration);
    if (d < bestDiff) { best = h; bestDiff = d; }
  }
  return best && bestDiff <= 10 ? best : null;
}

async function lrcRedSynced(isrc: string): Promise<LyricLine[] | null> {
  try {
    const res = await fetch(`${LRCRED}/s/${encodeURIComponent(isrc)}.lrc`, { signal: timeoutSignal() });
    if (!res.ok) return null;
    const lines = parseLRC(await res.text());
    return lines.length ? lines : null;
  } catch {
    return null;
  }
}

/** lrc.red synced lyrics → JioSaavn plain lyrics. */
export async function fetchLyrics(song: JSSong): Promise<LyricsData> {
  const title = song.name.replace(/<[^>]+>/g, "");
  const artist = song.artists?.primary?.[0]?.name ?? getArtistString(song);
  const hit = pickBestHit(await lrcRedSearch(`${title} ${artist}`.trim()), song.duration);
  if (hit) {
    const synced = await lrcRedSynced(hit.isrc);
    if (synced) return { synced, plain: null, source: "lrc.red" };
  }
  try {
    const saavn = await fetchSaavnLyrics(song.id, timeoutSignal());
    if (saavn) return { synced: null, plain: saavn, source: "JioSaavn" };
  } catch {
    /* noop */
  }
  return { synced: null, plain: null, source: null };
}

export function useLyrics(song: JSSong | null) {
  return useQuery({
    queryKey: ["lyrics", song?.id],
    queryFn: () => fetchLyrics(song!),
    enabled: !!song,
    staleTime: 1000 * 60 * 60,
  });
}

function cleanTitle(t: string) {
  return t.replace(/\s*[([](from|feat\.?|ft\.?)[^)\]]*[)\]]/gi, "").trim();
}

/** Find playable songs by a lyric line: lrc.red lyric search → JioSaavn lookup. */
export async function searchByLyrics(text: string, limit = 5): Promise<JSSong[]> {
  const q = text.trim();
  if (q.length < 3) return [];
  const seenPair = new Set<string>();
  const pairs = (await lrcRedSearch(q, true))
    .filter((h) => {
      const k = `${cleanTitle(h.title)}|${h.artist}`.toLowerCase();
      if (seenPair.has(k)) return false;
      seenPair.add(k);
      return true;
    })
    .slice(0, limit);

  const hits = await Promise.all(
    pairs.map(async (h) => {
      try {
        const firstArtist = h.artist.split(",")[0]?.trim() ?? "";
        const r = await searchSongs(`${cleanTitle(h.title)} ${firstArtist}`.trim());
        return r[0] ?? null;
      } catch {
        return null;
      }
    }),
  );
  const seen = new Set<string>();
  return hits.filter((s): s is JSSong => {
    if (!s || seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}
