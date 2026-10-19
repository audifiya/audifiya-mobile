import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
  nbsp: " ",
};

/** Decode common HTML entities from API text so it can be rendered as plain text. */
export function decodeEntities(input: unknown): string {
  const s = typeof input === "string" ? input : String(input ?? "");
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, code: string) => {
    const known = ENTITIES[code.toLowerCase()];
    if (known) return known;
    if (code.startsWith("#x") || code.startsWith("#X")) {
      const n = parseInt(code.slice(2), 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    if (code.startsWith("#")) {
      const n = parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return m;
  });
}

/** Strip any markup and decode entities — for untrusted/imported text. */
export function sanitizeText(input: unknown): string {
  return decodeEntities(input).replace(/<[^>]*>/g, "").trim();
}
