import { Check, Loader2, X } from "lucide-react";

type Status = "idle" | "checking" | "available" | "taken" | "invalid";

export function UsernameField({
  value,
  onChange,
  status,
}: {
  value: string;
  onChange: (v: string) => void;
  status: Status;
}) {
  return (
    <div className="mb-6">
      <div className="relative">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\s/g, "").slice(0, 20))}
          placeholder="username"
          autoCapitalize="none"
          autoCorrect="off"
          className="w-full rounded-md border border-border bg-surface-card px-4 py-3 pr-10 text-foreground outline-none focus:border-brand"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2">
          {status === "checking" && <Loader2 className="h-4 w-4 animate-spin text-text-secondary" />}
          {status === "available" && <Check className="h-4 w-4 text-brand" />}
          {(status === "taken" || status === "invalid") && <X className="h-4 w-4 text-destructive" />}
        </span>
      </div>
      <p className="mt-1.5 min-h-[1rem] text-xs">
        {status === "available" && <span className="text-brand">Username available</span>}
        {status === "taken" && <span className="text-destructive">Username taken</span>}
        {status === "invalid" && (
          <span className="text-destructive">3–20 letters, numbers or underscores</span>
        )}
      </p>
    </div>
  );
}
