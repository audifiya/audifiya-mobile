import { useEffect, useState } from "react";
import { getArtistString, getThumbnail, type JSSong } from "./jiosaavn";
import { sanitizeText } from "./utils";

export interface Playlist {
  id: string;
  name: string;
  songs: JSSong[];
  createdAt: number;
}

const KEY = "app_playlists";

export function readPlaylists(): Playlist[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Playlist[];
  } catch {
    return [];
  }
}

function writePlaylists(list: Playlist[]) {
  window.localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("app-playlists-changed"));
}

export function createPlaylist(name: string): Playlist {
  const list = readPlaylists();
  const pl: Playlist = {
    id: crypto.randomUUID(),
    name: name.trim() || `Playlist ${list.length + 1}`,
    songs: [],
    createdAt: Date.now(),
  };
  writePlaylists([pl, ...list]);
  return pl;
}

export function deletePlaylist(id: string) {
  writePlaylists(readPlaylists().filter((p) => p.id !== id));
}

export function addSongToPlaylist(id: string, song: JSSong) {
  const list = readPlaylists();
  const idx = list.findIndex((p) => p.id === id);
  if (idx < 0) return;
  if (list[idx].songs.some((s) => s.id === song.id)) return;
  list[idx] = { ...list[idx], songs: [...list[idx].songs, song] };
  writePlaylists(list);
}

export function removeSongFromPlaylist(id: string, songId: string) {
  const list = readPlaylists();
  const idx = list.findIndex((p) => p.id === id);
  if (idx < 0) return;
  list[idx] = { ...list[idx], songs: list[idx].songs.filter((s) => s.id !== songId) };
  writePlaylists(list);
}

export function getPlaylist(id: string): Playlist | undefined {
  return readPlaylists().find((p) => p.id === id);
}

export function usePlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  useEffect(() => {
    setPlaylists(readPlaylists());
    const h = () => setPlaylists(readPlaylists());
    window.addEventListener("app-playlists-changed", h);
    return () => window.removeEventListener("app-playlists-changed", h);
  }, []);
  return playlists;
}

// -------- Liked Songs --------
const LIKED_KEY = "spotify_liked_songs";
const LIKED_KEY_LEGACY = "liked_songs";

export function readLiked(): JSSong[] {
  if (typeof window === "undefined") return [];
  try {
    let raw = window.localStorage.getItem(LIKED_KEY);
    if (!raw) {
      const legacy = window.localStorage.getItem(LIKED_KEY_LEGACY);
      if (legacy) {
        window.localStorage.setItem(LIKED_KEY, legacy);
        window.localStorage.removeItem(LIKED_KEY_LEGACY);
        raw = legacy;
      }
    }
    return raw ? (JSON.parse(raw) as JSSong[]) : [];
  } catch {
    return [];
  }
}

function writeLiked(list: JSSong[]) {
  window.localStorage.setItem(LIKED_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("app-liked-changed"));
}


export function isLiked(id: string): boolean {
  return readLiked().some((s) => s.id === id);
}

export function toggleLiked(song: JSSong): boolean {
  const list = readLiked();
  const idx = list.findIndex((s) => s.id === song.id);
  if (idx >= 0) {
    list.splice(idx, 1);
    writeLiked(list);
    return false;
  }
  writeLiked([song, ...list]);
  return true;
}

export function useLikedIds() {
  const [ids, setIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const sync = () => setIds(new Set(readLiked().map((s) => s.id)));
    sync();
    window.addEventListener("app-liked-changed", sync);
    return () => window.removeEventListener("app-liked-changed", sync);
  }, []);
  return ids;
}

// -------- Search History --------
const SEARCH_KEY = "spotify_search_history";

export function readSearchHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(SEARCH_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeSearchHistory(list: string[]) {
  window.localStorage.setItem(SEARCH_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("app-search-history-changed"));
}

export function pushSearchHistory(query: string) {
  const q = query.trim();
  if (!q) return;
  const list = readSearchHistory().filter(
    (x) => x.toLowerCase() !== q.toLowerCase(),
  );
  list.unshift(q);
  writeSearchHistory(list.slice(0, 10));
}

export function removeSearchHistory(query: string) {
  writeSearchHistory(readSearchHistory().filter((x) => x !== query));
}

export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setHistory(readSearchHistory());
    sync();
    window.addEventListener("app-search-history-changed", sync);
    return () => window.removeEventListener("app-search-history-changed", sync);
  }, []);
  return history;
}

// -------- Playback History (lightweight: last 5 minimal records) --------
const PLAYBACK_KEY = "spotify_playback_history";
const PLAYBACK_LIMIT = 5;

/** Minimal record kept in storage — never the full song JSON. */
function toMiniTrack(song: JSSong): JSSong {
  const image = getThumbnail(song);
  const artist = getArtistString(song);
  return {
    id: song.id,
    name: song.name,
    image: image ? [{ quality: "150x150", url: image }] : [],
    downloadUrl: [],
    artists: artist ? { primary: [{ id: "", name: artist }] } : undefined,
  } as JSSong;
}

export function readPlaybackHistory(): JSSong[] {
  if (typeof window === "undefined") return [];
  try {
    const list = JSON.parse(
      window.localStorage.getItem(PLAYBACK_KEY) || "[]",
    ) as JSSong[];
    return Array.isArray(list) ? list.slice(0, PLAYBACK_LIMIT) : [];
  } catch {
    return [];
  }
}

function writePlaybackHistory(list: JSSong[]) {
  window.localStorage.setItem(PLAYBACK_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("app-playback-history-changed"));
}

export function pushPlaybackHistory(song: JSSong) {
  if (!song?.id) return;
  const filtered = readPlaybackHistory().filter((s) => s.id !== song.id);
  filtered.unshift(toMiniTrack(song));
  writePlaybackHistory(filtered.slice(0, PLAYBACK_LIMIT));
}

export function removePlaybackHistoryItem(id: string) {
  writePlaybackHistory(readPlaybackHistory().filter((s) => s.id !== id));
}

export function clearPlaybackHistory() {
  writePlaybackHistory([]);
}

export function usePlaybackHistory() {
  const [items, setItems] = useState<JSSong[]>([]);
  useEffect(() => {
    const sync = () => setItems(readPlaybackHistory());
    sync();
    window.addEventListener("app-playback-history-changed", sync);
    return () =>
      window.removeEventListener("app-playback-history-changed", sync);
  }, []);
  return items;
}

// -------- Explicitly saved (offline) tracks --------
const SAVED_KEY = "spotify_saved_offline_tracks";

export function readSaved(): JSSong[] {
  if (typeof window === "undefined") return [];
  try {
    const list = JSON.parse(window.localStorage.getItem(SAVED_KEY) || "[]");
    return Array.isArray(list) ? (list as JSSong[]) : [];
  } catch {
    return [];
  }
}

function writeSaved(list: JSSong[]) {
  window.localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("app-saved-tracks-changed"));
}

export function isSaved(id: string): boolean {
  return readSaved().some((s) => s.id === id);
}

/** Returns true when the song was saved, false when it was removed. */
export function toggleSaved(song: JSSong): boolean {
  const list = readSaved();
  const idx = list.findIndex((s) => s.id === song.id);
  if (idx >= 0) {
    list.splice(idx, 1);
    writeSaved(list);
    return false;
  }
  writeSaved([song, ...list]);
  return true;
}

export function useSavedIds() {
  const [ids, setIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const sync = () => setIds(new Set(readSaved().map((s) => s.id)));
    sync();
    window.addEventListener("app-saved-tracks-changed", sync);
    return () => window.removeEventListener("app-saved-tracks-changed", sync);
  }, []);
  return ids;
}

// -------- Playlist Share/Import Tokens --------
export function encodePlaylistToken(pl: Pick<Playlist, "name" | "songs">): string {
  const payload = { name: pl.name, songs: pl.songs };
  const json = JSON.stringify(payload);
  if (json.length > 6000) {
    const compact = {
      name: pl.name,
      ids: pl.songs.map((s) => ({ id: s.id, name: s.name })),
    };
    return "c:" + btoa(encodeURIComponent(JSON.stringify(compact)));
  }
  return "f:" + btoa(encodeURIComponent(json));
}

function cleanSong(raw: unknown): JSSong | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.id !== "string" || !s.id) return null;
  const urls = (list: unknown) =>
    Array.isArray(list)
      ? list
          .filter((u): u is { quality?: string; url: string } =>
            !!u && typeof u === "object" && typeof (u as { url?: unknown }).url === "string" &&
            /^https?:\/\//i.test((u as { url: string }).url),
          )
          .map((u) => ({ quality: String(u.quality ?? ""), url: u.url }))
      : [];
  return {
    ...(raw as JSSong),
    id: s.id,
    name: sanitizeText(s.name),
    image: urls(s.image),
    downloadUrl: urls(s.downloadUrl),
  } as JSSong;
}

export function decodePlaylistToken(
  token: string,
): { name: string; songs: JSSong[] } | null {
  try {
    const mode = token.slice(0, 2);
    const body = token.slice(2);
    const json = decodeURIComponent(atob(body));
    const parsed = JSON.parse(json);
    const name = sanitizeText(parsed?.name) || "Imported playlist";
    if (mode === "f:") {
      const songs = ((Array.isArray(parsed.songs) ? parsed.songs : []) as unknown[])
        .map(cleanSong)
        .filter((s): s is JSSong => s !== null);
      return { name, songs };
    }
    // compact: no song bodies — import with placeholders (still show titles)
    if (mode === "c:") {
      const songs: JSSong[] = (Array.isArray(parsed.ids) ? parsed.ids : [])
        .filter((x: unknown) => !!x && typeof (x as { id?: unknown }).id === "string")
        .map((x: { id: string; name?: unknown }) => ({
          id: x.id,
          name: sanitizeText(x.name),
          image: [],
          downloadUrl: [],
        })) as JSSong[];
      return { name, songs };
    }
    return null;
  } catch {
    return null;
  }
}

export function importPlaylistFromToken(token: string): Playlist | null {
  const parsed = decodePlaylistToken(token);
  if (!parsed) return null;
  const list = readPlaylists();
  let name = parsed.name;
  if (list.some((p) => p.name === name)) name = `${name} (imported)`;
  const pl: Playlist = {
    id: crypto.randomUUID(),
    name,
    songs: parsed.songs,
    createdAt: Date.now(),
  };
  writePlaylists([pl, ...list]);
  return pl;
}
