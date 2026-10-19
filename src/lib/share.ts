import { z } from "zod";
import { supabase } from "./supabaseClient";

const idSchema = z.string().uuid();
const songIdsSchema = z.array(z.string().min(1).max(64)).min(1).max(500);

export async function createShareLink(songIds: string[]): Promise<string> {
  const ids = songIdsSchema.parse(Array.from(new Set(songIds)));
  const id = crypto.randomUUID();
  const { error } = await supabase.from("shared_playlists").insert({ id, song_ids: ids });
  if (error) throw new Error(error.message);
  return `${window.location.origin}/share/${id}`;
}

export type SharedResult =
  | { status: "ok"; songIds: string[]; expiresAt: string }
  | { status: "expired" };

export async function loadSharedPlaylist(id: string): Promise<SharedResult> {
  if (!idSchema.safeParse(id).success) return { status: "expired" };
  const { data, error } = await supabase
    .from("shared_playlists")
    .select("song_ids, expires_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || new Date() > new Date(data.expires_at)) return { status: "expired" };
  const ids = songIdsSchema.safeParse(data.song_ids);
  if (!ids.success) return { status: "expired" };
  return { status: "ok", songIds: ids.data, expiresAt: data.expires_at };
}
