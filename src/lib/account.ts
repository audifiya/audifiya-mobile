import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export const BAN_KEY = "audiFiya_banned";
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export interface DbProfile {
  id: string;
  username: string;
  is_banned: boolean;
}

export async function ensureSession(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error) return null;
  return anon.user?.id ?? null;
}

export async function isUsernameAvailable(name: string): Promise<boolean | null> {
  const u = name.trim().toLowerCase();
  if (!USERNAME_RE.test(u)) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("username")
    .eq("username", u)
    .maybeSingle();
  if (error) return null;
  return !data;
}

export async function claimUsername(name: string): Promise<{ ok: boolean; error?: string }> {
  const u = name.trim().toLowerCase();
  if (!USERNAME_RE.test(u)) return { ok: false, error: "3–20 letters, numbers or _" };
  const uid = await ensureSession();
  if (!uid) return { ok: false, error: "Couldn't create your account. Try again." };
  const { error } = await supabase.from("profiles").insert({ id: uid, username: u });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Username taken" };
    return { ok: false, error: "Couldn't save username. Try again." };
  }
  window.dispatchEvent(new CustomEvent("app-account-changed"));
  return { ok: true };
}

/** Loads the visitor's database profile; skip=true on the admin route. */
export function useAccount(skip: boolean) {
  const [state, setState] = useState<{ ready: boolean; session: boolean; profile: DbProfile | null; banned: boolean }>({
    ready: false,
    session: false,
    profile: null,
    banned: false,
  });

  useEffect(() => {
    if (skip) return;
    let active = true;
    const flagged = localStorage.getItem(BAN_KEY) === "true";
    if (flagged) setState((s) => ({ ...s, banned: true }));
    const load = async () => {
      const uid = await ensureSession();
      if (!uid || !active) {
        if (active) setState((s) => ({ ...s, ready: true }));
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, is_banned")
        .eq("id", uid)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setState((s) => ({ ...s, ready: true }));
        return;
      }
      const banned = !!data?.is_banned;
      if (banned) localStorage.setItem(BAN_KEY, "true");
      else localStorage.removeItem(BAN_KEY);
      setState({ ready: true, session: true, profile: (data as DbProfile) ?? null, banned });
    };
    void load();
    const h = () => void load();
    window.addEventListener("app-account-changed", h);
    return () => {
      active = false;
      window.removeEventListener("app-account-changed", h);
    };
  }, [skip]);

  return state;
}

export function useUsernameCheck(input: string) {
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  useEffect(() => {
    const u = input.trim().toLowerCase();
    if (!u) return setStatus("idle");
    if (!USERNAME_RE.test(u)) return setStatus("invalid");
    setStatus("checking");
    let active = true;
    const t = setTimeout(async () => {
      const ok = await isUsernameAvailable(u);
      if (active) setStatus(ok === null ? "idle" : ok ? "available" : "taken");
    }, 500);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [input]);
  return status;
}
