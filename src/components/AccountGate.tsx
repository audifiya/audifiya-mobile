import { useState } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { claimUsername, useUsernameCheck } from "@/lib/account";
import { readProfile, writeProfile } from "@/lib/user-profile";
import { UsernameField } from "./UsernameField";

export function BannedScreen() {
  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-background p-6">
      <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-white/5 p-8 text-center backdrop-blur-3xl">
        <Ban className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-4 text-xl font-bold">Account banned</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Your account has been banned due to a violation of terms.
        </p>
      </div>
    </div>
  );
}

/** One-time prompt for users who onboarded before usernames existed. */
export function UsernamePrompt() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const status = useUsernameCheck(name);
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/85 p-4 backdrop-blur">
      <div className="w-full max-w-md rounded-lg bg-surface-main p-8 shadow-2xl">
        <h2 className="mb-1 text-xl font-bold">Pick a username</h2>
        <p className="mb-5 text-sm text-text-secondary">One quick step — usernames are now unique.</p>
        <UsernameField value={name} onChange={setName} status={status} />
        <button
          disabled={status !== "available" || busy}
          onClick={async () => {
            setBusy(true);
            const r = await claimUsername(name);
            setBusy(false);
            if (!r.ok) return toast.error(r.error);
            const p = readProfile();
            if (p) writeProfile({ ...p, username: name.trim().toLowerCase() });
          }}
          className="w-full rounded-full py-3 font-bold text-black disabled:opacity-40"
          style={{ backgroundColor: "var(--color-brand)" }}
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
