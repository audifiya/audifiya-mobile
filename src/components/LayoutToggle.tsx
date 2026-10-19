import { LayoutGrid, List } from "lucide-react";
import type { LayoutPreference } from "@/lib/layout-pref";

interface Props {
  value: LayoutPreference;
  onChange: (v: LayoutPreference) => void;
}

export function LayoutToggle({ value, onChange }: Props) {
  const btn = (mode: LayoutPreference, label: string, Icon: typeof List) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={value === mode}
      onClick={() => onChange(mode)}
      className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-white/10"
      style={{
        color:
          value === mode
            ? "var(--color-brand)"
            : "var(--color-text-secondary)",
      }}
    >
      <Icon className="h-4 w-4" />
    </button>
  );

  return (
    <div
      className="flex items-center gap-1 rounded-full p-1"
      style={{ backgroundColor: "var(--color-surface-card)" }}
    >
      {btn("grid", "Grid view", LayoutGrid)}
      {btn("list", "List view", List)}
    </div>
  );
}

export const layoutContainerClass = (pref: LayoutPreference) =>
  pref === "list"
    ? "flex flex-col gap-2 w-full"
    : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4";
