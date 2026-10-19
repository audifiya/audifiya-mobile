import type { JSSong } from "./jiosaavn";

export type TrackMood = "rocking" | "melodic" | "neutral";

const ROCKING = ["rock", "metal", "bass", "edm", "party", "badshah"];
const MELODIC = ["romantic", "lofi", "arijit", "shreya", "love", "sad"];

/** Guess a mood from text metadata (no audio analysis available). */
export function getTrackMoodTheme(song: JSSong | null | undefined): TrackMood {
  if (!song) return "neutral";
  const s = song as unknown as Record<string, unknown>;
  const text = [
    song.name,
    song.album?.name,
    ...(song.artists?.primary?.map((a) => a.name) ?? []),
    ...(song.artists?.all?.map((a) => a.name) ?? []),
    s.genre,
    s.language,
    s.primary_artists,
  ]
    .filter((v) => typeof v === "string")
    .join(" ")
    .toLowerCase();
  const has = (k: string) => new RegExp(`\\b${k}`).test(text);
  if (ROCKING.some(has)) return "rocking";
  if (MELODIC.some(has)) return "melodic";
  return "neutral";
}
