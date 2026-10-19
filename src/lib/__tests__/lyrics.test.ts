import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLyrics, parseLRC, pickBestHit, searchByLyrics } from "../lyrics";
import { parseSaavnLyrics, type JSSong } from "../jiosaavn";

const song = {
  id: "s1",
  name: "Tum Hi Ho",
  duration: 262,
  image: [],
  downloadUrl: [],
  artists: { primary: [{ id: "a", name: "Arijit Singh" }] },
} as JSSong;

function mockFetch(routes: [RegExp, unknown | string | null][]) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(url);
      const hit = routes.find(([re]) => re.test(url));
      if (!hit || hit[1] === null) return new Response("nf", { status: 404 });
      const body = typeof hit[1] === "string" ? hit[1] : JSON.stringify(hit[1]);
      return new Response(body, { status: 200 });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("lyrics: lrc.red then JioSaavn", () => {
  it("uses lrc.red synced lyrics first", async () => {
    mockFetch([
      [/lrc\.red\/search\.json/, { hits: [{ isrc: "IN1", title: "Tum Hi Ho", artist: "Arijit Singh", duration: 261.9 }] }],
      [/lrc\.red\/s\/IN1\.lrc/, "[ti:Tum Hi Ho]\n[00:10.23]<00:10.23>Hum <00:11.09>tere <00:11.75>bin"],
    ]);
    const r = await fetchLyrics(song);
    expect(r.source).toBe("lrc.red");
    expect(r.synced).toEqual([{ time: 10.23, text: "Hum tere bin" }]);
  });

  it("falls back to JioSaavn when lrc.red fails", async () => {
    mockFetch([
      [/lrc\.red/, null],
      [/songs\/s1\/lyrics/, { data: { lyrics: "Hum Tere Bin<br>Tere Bina" } }],
    ]);
    const r = await fetchLyrics(song);
    expect(r).toEqual({ synced: null, plain: "Hum Tere Bin\nTere Bina", source: "JioSaavn" });
  });

  it("falls back to JioSaavn when no lrc.red hit is within 10s", async () => {
    mockFetch([
      [/lrc\.red\/search\.json/, { hits: [{ isrc: "X", title: "Other", artist: "Y", duration: 400 }] }],
      [/songs\/s1\/lyrics/, { data: { lyrics: "Plain" } }],
    ]);
    expect((await fetchLyrics(song)).source).toBe("JioSaavn");
  });
});

describe("pickBestHit", () => {
  it("picks the closest duration", () => {
    const hits = [
      { isrc: "a", title: "", artist: "", duration: 250 },
      { isrc: "b", title: "", artist: "", duration: 263 },
    ];
    expect(pickBestHit(hits, 262)?.isrc).toBe("b");
  });
});

describe("parsers", () => {
  it("parseLRC strips word stamps and skips metadata", () => {
    expect(parseLRC("[ar:X]\n[00:01.00]<00:01.00>A <00:01.50>B")).toEqual([{ time: 1, text: "A B" }]);
  });
  it("parseSaavnLyrics converts <br> to newlines", () => {
    expect(parseSaavnLyrics("A<br/>B<b>c</b>")).toBe("A\nBc");
  });
});

describe("searchByLyrics", () => {
  it("hands lrc.red lyric hits to JioSaavn and dedupes", async () => {
    const calls = mockFetch([
      [/lrc\.red\/search\.json\?.*in=lyrics/, { hits: [
        { isrc: "1", title: 'Kesariya (From "Brahmastra")', artist: "Pritam, Arijit Singh" },
        { isrc: "2", title: "Kesariya", artist: "Pritam, Arijit Singh" },
        { isrc: "3", title: "Kesariya Rangu", artist: "Pritam" },
      ] }],
      [/search\/songs/, { data: { results: [{ id: "same" }] } }],
    ]);
    const r = await searchByLyrics("kesariya tera ishq hai piya");
    expect(r.map((s) => s.id)).toEqual(["same"]);
    expect(calls.filter((c) => c.includes("search/songs"))).toHaveLength(2);
    expect(calls.some((c) => c.includes("query=Kesariya%20Pritam"))).toBe(true);
  });
});
