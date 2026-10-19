import { useEffect, useState } from "react";
import { writeProfile, type PreferredArtist } from "@/lib/user-profile";
import { BrandMark } from "@/components/BrandMark";
import { searchArtists, type JSArtistResult } from "@/lib/jiosaavn";
import { claimUsername, useUsernameCheck } from "@/lib/account";
import { UsernameField } from "@/components/UsernameField";
import { toast } from "sonner";

const LANGUAGES = [
  "english",
  "hindi",
  "punjabi",
  "spanish",
  "tamil",
  "telugu",
];

const SUGGESTED = ["Arijit Singh", "Taylor Swift", "Diljit Dosanjh", "Anirudh"];

export function OnboardingModal() {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [langs, setLangs] = useState<string[]>(["english"]);
  const [artists, setArtists] = useState<PreferredArtist[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<JSArtistResult[]>([]);
  const [closing, setClosing] = useState(false);

  const toggleLang = (l: string) =>
    setLangs((cur) =>
      cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l],
    );

  const toggleArtist = (a: PreferredArtist) =>
    setArtists((cur) =>
      cur.some((x) => x.id === a.id)
        ? cur.filter((x) => x.id !== a.id)
        : [...cur, a],
    );

  // Live artist search (debounced); empty query shows a suggested mix.
  useEffect(() => {
    if (step !== 2) return;
    let active = true;
    const term = query.trim();
    const t = setTimeout(async () => {
      const lists = await Promise.all(
        term
          ? [searchArtists(term)]
          : SUGGESTED.map((s) => searchArtists(s).then((r) => r.slice(0, 3))),
      );
      if (!active) return;
      const flat = lists.flat();
      const seen = new Set<string>();
      setResults(
        flat.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true))).slice(0, 18),
      );
    }, term ? 350 : 0);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, step]);

  const nameStatus = useUsernameCheck(name);
  const valid = nameStatus === "available" && langs.length > 0;
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    const r = await claimUsername(name);
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error);
      setStep(1);
      return;
    }
    setClosing(true);
    setTimeout(() => {
      writeProfile({ username: name.trim().toLowerCase(), languages: langs, artists });
    }, 220);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{
        backgroundColor: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        animation: closing
          ? "fade-out 200ms ease forwards"
          : "fade-in 300ms ease",
      }}
    >
      <div className="w-full max-w-md rounded-lg bg-surface-main p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div
            className="grid h-10 w-10 place-items-center rounded-full"
            style={{ backgroundColor: "var(--color-brand)" }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#000">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <BrandMark size="lg" tagline />
        </div>

        {step === 1 ? (
          <>
            <label className="mb-2 block text-sm font-medium text-text-secondary">
              Choose a username
            </label>
            <UsernameField value={name} onChange={setName} status={nameStatus} />
            <label className="mb-3 block text-sm font-medium text-text-secondary">
              Select your preferred music languages
            </label>
            <div className="mb-8 flex flex-wrap gap-2">
              {LANGUAGES.map((l) => {
                const active = langs.includes(l);
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => toggleLang(l)}
                    className="rounded-full px-4 py-2 text-sm font-medium capitalize transition-colors"
                    style={{
                      backgroundColor: active
                        ? "var(--color-brand)"
                        : "var(--color-surface-card)",
                      color: active ? "#000" : "var(--color-foreground)",
                    }}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setStep(2)}
              disabled={!valid}
              className="w-full rounded-full py-3 font-bold transition-transform disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: "var(--color-brand)", color: "#000" }}
            >
              Continue
            </button>
          </>
        ) : (
          <>
            <label className="mb-3 block text-sm font-medium text-text-secondary">
              Pick a few artists you love
            </label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search artists"
              className="mb-4 w-full rounded-full border border-border bg-surface-card px-4 py-3 text-sm text-foreground outline-none focus:border-brand"
            />
            <div className="mb-6 grid max-h-[240px] grid-cols-3 gap-3 overflow-y-auto no-scrollbar">
              {results.map((a) => {
                const active = artists.some((x) => x.id === a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() =>
                      toggleArtist({ id: a.id, name: a.name, image: a.imageUrl })
                    }
                    className="flex flex-col items-center gap-2 rounded-lg p-2 transition-colors"
                    style={{
                      backgroundColor: active
                        ? "var(--color-surface-card-hover)"
                        : "transparent",
                    }}
                  >
                    <img
                      src={a.imageUrl}
                      alt=""
                      loading="lazy"
                      className="h-16 w-16 rounded-full object-cover"
                      style={{
                        outline: active
                          ? "2px solid var(--color-brand)"
                          : "none",
                        outlineOffset: "2px",
                      }}
                    />
                    <span className="line-clamp-2 text-center text-xs font-medium">
                      {a.name}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button
                onClick={submit}
                className="flex-1 rounded-full py-3 text-sm font-semibold"
                style={{
                  backgroundColor: "var(--color-surface-card)",
                  color: "var(--color-foreground)",
                }}
              >
                Skip
              </button>
              <button
                onClick={submit}
                className="flex-[2] rounded-full py-3 font-bold"
                style={{ backgroundColor: "var(--color-brand)", color: "#000" }}
              >
                Start Listening
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
