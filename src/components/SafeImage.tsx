import { useEffect, useMemo, useState } from "react";
import { Music2 } from "lucide-react";

const INVALID_IMAGE_STRINGS = new Set(["", "null", "undefined", "about:blank", "#", "[object object]"]);

/**
 * Normalises anything an API might hand us (string, array of strings,
 * array/object of { url | link | src }) into a single absolute, safe URL,
 * or `null`. Relative paths are rejected on purpose: inside Electron they
 * resolve against file:// and trigger the recursive redirect crash.
 */
export function resolveImageUrl(input: unknown, depth = 0): string | null {
  if (input == null || depth > 3) return null;

  if (Array.isArray(input)) {
    for (const item of input) {
      const url = resolveImageUrl(item, depth + 1);
      if (url) return url;
    }
    return null;
  }

  if (typeof input === "object") {
    const o = input as Record<string, unknown>;
    return resolveImageUrl(o.url ?? o.link ?? o.src, depth + 1);
  }

  if (typeof input !== "string") return null;

  let s = input.trim();
  if (INVALID_IMAGE_STRINGS.has(s.toLowerCase())) return null;
  if (s.startsWith("//")) s = `https:${s}`;

  if (/^https?:\/\/[^\s/]+/i.test(s) || /^data:image\//i.test(s) || /^blob:/i.test(s)) return s;
  return null;
}

/** Never renders an <img> unless the URL is valid; falls back to a div. */
export function SafeImage({
  src,
  alt = "",
  className = "",
  iconSize = 16,
}: {
  src: unknown;
  alt?: string;
  className?: string;
  iconSize?: number;
}) {
  const url = useMemo(() => resolveImageUrl(src), [src]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (!url || failed) {
    return (
      <div
        aria-hidden="true"
        className={`flex items-center justify-center bg-gradient-to-br from-neutral-700 to-neutral-900 text-white/40 ${className}`}
      >
        <Music2 size={iconSize} />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      draggable={false}
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
