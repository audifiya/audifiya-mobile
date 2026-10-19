import { User } from "lucide-react";
import type { JSSong } from "@/lib/jiosaavn";
import { getArtistString, getPrimaryArtist } from "@/lib/jiosaavn";
import { useArtistView } from "@/lib/artist-view";

interface Props {
  song?: JSSong | null;
  size?: "sm" | "md";
  className?: string;
}

export function ArtistTag({ song, size = "sm", className }: Props) {
  const primary = getPrimaryArtist(song);
  const openArtist = useArtistView((s) => s.openArtist);
  const dim = size === "md" ? "h-6 w-6" : "h-5 w-5";

  const inner = (
    <>
      {primary?.imageUrl ? (
        <img
          src={primary.imageUrl}
          alt=""
          loading="lazy"
          className={`${dim} shrink-0 rounded-full object-cover`}
        />
      ) : (
        <span
          className={`${dim} grid shrink-0 place-items-center rounded-full`}
          style={{ backgroundColor: "var(--color-surface-card-hover)" }}
        >
          <User
            className="h-3 w-3"
            style={{ color: "var(--color-text-secondary)" }}
          />
        </span>
      )}
      <span className="truncate">{getArtistString(song)}</span>
    </>
  );

  if (primary?.id) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          openArtist(primary.id!, primary.name);
        }}
        className={`inline-flex min-w-0 items-center gap-1.5 text-left transition-colors hover:underline ${className ?? ""}`}
      >
        {inner}
      </button>
    );
  }

  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className ?? ""}`}>
      {inner}
    </span>
  );
}
