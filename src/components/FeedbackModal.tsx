import { useEffect, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useThemeMode } from "@/lib/theme-mode";

const CATEGORIES = ["Bug", "Request", "Feedback"] as const;

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(100),
  category: z.enum(CATEGORIES),
  message: z.string().trim().min(1, "Please write a message").max(2000),
});

export function FeedbackWidget() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { light, liquid } = useThemeMode();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("Feedback");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const lastY = useRef(new WeakMap<object, number>());

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  useEffect(() => {
    const onScroll = (e: Event) => {
      const t = e.target;
      if (t instanceof Node && rootRef.current?.contains(t)) return;
      const el = t instanceof Element ? t : document.scrollingElement;
      if (!el) return;
      const y = el.scrollTop;
      const prev = lastY.current.get(el) ?? 0;
      if (y > prev && y > 50) {
        setVisible(false);
        setOpen(false);
      } else if (y < prev || y <= 50) {
        setVisible(true);
      }
      lastY.current.set(el, y);
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, []);

  if (pathname.startsWith("/audifiya-admin-panel")) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ name, category, message });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("user_submissions").insert([parsed.data]);
    setBusy(false);
    if (error) {
      toast.error("Couldn't send right now. Please try again.");
      return;
    }
    toast.success("Thanks! Your message was sent.");
    setName("");
    setMessage("");
    setOpen(false);
  };

  const panel = light
    ? "bg-white/70 border-black/10 text-gray-900"
    : "bg-black/40 border-white/20 text-white";
  const field = light
    ? "w-full rounded-xl border border-black/10 bg-white/60 px-3 py-2 text-sm outline-none focus:bg-white/90"
    : "w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm outline-none focus:bg-white/15";

  return (
    <div
      ref={rootRef}
      className={`fixed right-4 z-[60] transition-all duration-500 ease-in-out md:right-8 md:!bottom-8 ${
        liquid
          ? "bottom-[calc(90px+env(safe-area-inset-bottom))]"
          : "bottom-[calc(90px+env(safe-area-inset-bottom))]"
      } ${visible ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-12 opacity-0"}`}
    >
      {open && (
        <form
          onSubmit={submit}
          className={`absolute bottom-[68px] right-0 flex w-[320px] max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-2xl border p-4 shadow-2xl backdrop-blur-3xl ${panel}`}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Chat with AudiFiya</h2>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <input className={field} placeholder="Your name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
          <select
            className={field}
            value={category}
            onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="text-black">{c}</option>
            ))}
          </select>
          <textarea
            className={`${field} h-28 resize-none`}
            placeholder="How can we help?"
            value={message}
            maxLength={2000}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full py-2 text-sm font-bold disabled:opacity-60"
            style={{ backgroundColor: "var(--color-brand)", color: "#000" }}
          >
            {busy ? "Sending…" : "Send"}
          </button>
        </form>
      )}
      <button
        type="button"
        aria-label={open ? "Close feedback" : "Send feedback"}
        onClick={() => setOpen((o) => !o)}
        className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-emerald-500/80 text-black shadow-lg backdrop-blur-md transition-transform hover:scale-105"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
