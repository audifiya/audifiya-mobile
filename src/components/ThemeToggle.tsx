import { Droplet, LayoutGrid, Sun } from "lucide-react";
import { useThemeMode } from "@/lib/theme-mode";

const LABELS = {
  standard: "Standard",
  "liquid-dark": "Liquid glass (dark)",
  "liquid-light": "Liquid glass (light)",
} as const;

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { mode, liquid, light, cycleTheme } = useThemeMode();

  const thumbShift =
    mode === "standard"
      ? "translate-x-0"
      : mode === "liquid-dark"
        ? "translate-x-[22px]"
        : "translate-x-[44px]";

  return (
    <button
      type="button"
      aria-label={`Theme: ${LABELS[mode]}. Switch theme`}
      title={LABELS[mode]}
      onClick={cycleTheme}
      className={`relative h-8 w-[76px] shrink-0 rounded-full transition-all duration-300 ${
        liquid
          ? light
            ? "border border-black/10 bg-black/10 backdrop-blur-md"
            : "border border-white/10 bg-white/20 backdrop-blur-md"
          : "border border-transparent bg-[#2a2a2a]"
      } ${className}`}
    >
      <span
        className={`absolute top-1 left-1 grid h-6 w-6 place-items-center rounded-full bg-white text-black shadow transition-transform duration-300 ${thumbShift}`}
      >
        {mode === "standard" ? (
          <LayoutGrid className="h-3.5 w-3.5" />
        ) : mode === "liquid-dark" ? (
          <Droplet className="h-3.5 w-3.5 fill-current" />
        ) : (
          <Sun className="h-3.5 w-3.5" />
        )}
      </span>
    </button>
  );
}
