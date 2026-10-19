import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import type { JSSong } from "@/lib/jiosaavn";
import { toggleSaved, useSavedIds } from "@/lib/library";

interface Props {
  song: JSSong;
  size?: number;
  className?: string;
}

export function SaveButton({ song, size = 16, className = "" }: Props) {
  const savedIds = useSavedIds();
  const saved = savedIds.has(song.id);
  const title = song.name.replace(/<[^>]+>/g, "");

  return (
    <button
      type="button"
      aria-label={saved ? "Remove from local library" : "Save to local library"}
      title={saved ? "Saved locally" : "Save to Local Library"}
      onClick={(e) => {
        e.stopPropagation();
        const now = toggleSaved(song);
        toast.success(now ? `Saved locally: ${title}` : `Removed: ${title}`);
      }}
      className={`grid shrink-0 place-items-center rounded-full transition-colors hover:bg-white/10 ${className}`}
      style={{
        color: saved ? "var(--color-brand)" : "var(--color-text-secondary)",
        height: size + 12,
        width: size + 12,
      }}
    >
      <Bookmark
        style={{ height: size, width: size }}
        fill={saved ? "currentColor" : "none"}
      />
    </button>
  );
}
