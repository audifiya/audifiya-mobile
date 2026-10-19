import { describe, expect, it } from "vitest";
import { getTrackMoodTheme } from "../lyrics-mood";
import type { JSSong } from "../jiosaavn";

const song = (name: string, artist: string) =>
  ({ id: "1", name, artists: { primary: [{ name: artist }] } }) as unknown as JSSong;

describe("getTrackMoodTheme", () => {
  it("Badshah is rocking", () => expect(getTrackMoodTheme(song("Genda Phool", "Badshah"))).toBe("rocking"));
  it("Arijit is melodic", () => expect(getTrackMoodTheme(song("Kesariya", "Arijit Singh"))).toBe("melodic"));
  it("other is neutral", () => expect(getTrackMoodTheme(song("Naatu Naatu", "Rahul"))).toBe("neutral"));
  it("null is neutral", () => expect(getTrackMoodTheme(null)).toBe("neutral"));
});
