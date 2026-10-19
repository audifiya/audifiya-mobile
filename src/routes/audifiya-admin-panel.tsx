import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Download, LogOut, RefreshCw } from "lucide-react";
import { supabase, type Submission } from "@/lib/supabaseClient";

export const Route = createFileRoute("/audifiya-admin-panel")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin – AudiFiya" },
      { name: "description", content: "AudiFiya admin dashboard." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Admin – AudiFiya" },
      { property: "og:description", content: "AudiFiya admin dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const glass =
  "rounded-3xl border border-white/15 shadow-2xl backdrop-blur-[40px] saturate-[180%]";

function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto rounded-lg p-4 md:p-8"
      style={{ backgroundColor: "var(--color-surface-main)" }}
    >
      {!ready ? null : session ? <Tabs userId={session.user.id} /> : <Login />}
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const field =
    "w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm outline-none focus:bg-white/15";
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <form
        className={`${glass} w-full max-w-sm p-6`}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr("");
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          setBusy(false);
          if (error) setErr("Invalid email or password.");
        }}
      >
        <h1 className="mb-4 text-xl font-bold">Admin sign in</h1>
        <input className={field} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className={`${field} mt-3`} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
        <button
          disabled={busy}
          className="mt-4 w-full rounded-full py-2.5 text-sm font-bold disabled:opacity-60"
          style={{ backgroundColor: "var(--color-brand)", color: "#000" }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

function csvCell(v: unknown) {
  let s = String(v ?? "");
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

function exportCsv(rows: Submission[]) {
  const headers = ["Date", "Name", "Category", "Message", "Status"];
  const lines = rows.map((r) =>
    [new Date(r.created_at).toISOString(), r.name, r.category, r.message, r.status]
      .map(csvCell)
      .join(","),
  );
  const csvContent = [headers.join(","), ...lines].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "audifiya_leads.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function Dashboard({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Submission[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: adm, error: admErr } = await supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
    // No admins table on this database: rely on row-level rules instead
    const allowed = admErr ? true : !!adm;
    setIsAdmin(allowed);
    if (allowed) {
      const { data } = await supabase
        .from("user_submissions")
        .select("*")
        .order("created_at", { ascending: false });
      setRows((data as Submission[]) ?? []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const btn = "flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/10";

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Submissions</h1>
        <div className="flex flex-wrap gap-2">
          <button className={btn} onClick={() => void load()}><RefreshCw className="h-4 w-4" />Refresh</button>
          <button className={btn} disabled={!rows.length} onClick={() => exportCsv(rows)}><Download className="h-4 w-4" />Export to CSV</button>
          <button className={btn} onClick={() => supabase.auth.signOut()}><LogOut className="h-4 w-4" />Sign Out</button>
        </div>
      </div>
      {loading ? (
        <p style={{ color: "var(--color-text-secondary)" }}>Loading…</p>
      ) : !isAdmin ? (
        <p style={{ color: "var(--color-text-secondary)" }}>This account is not authorized to view submissions.</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "var(--color-text-secondary)" }}>No submissions yet.</p>
      ) : (
        <div className={`${glass} overflow-x-auto`}>
          <table className="w-full text-left text-sm">
            <thead style={{ color: "var(--color-text-secondary)" }}>
              <tr className="border-b border-white/10">
                <th className="p-3">Date</th><th className="p-3">Name</th><th className="p-3">Category</th><th className="p-3">Message</th><th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5 align-top">
                  <td className="whitespace-nowrap p-3">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-3">{r.name}</td>
                  <td className="p-3">{r.category}</td>
                  <td className="whitespace-pre-wrap p-3">{r.message}</td>
                  <td className="p-3 capitalize">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Tabs({ userId }: { userId: string }) {
  const [tab, setTab] = useState<"subs" | "users">("subs");
  const t = (k: "subs" | "users", label: string) => (
    <button
      onClick={() => setTab(k)}
      className="rounded-full px-4 py-1.5 text-sm font-semibold"
      style={tab === k ? { backgroundColor: "var(--color-brand)", color: "#000" } : { color: "var(--color-text-secondary)" }}
    >
      {label}
    </button>
  );
  return (
    <>
      <div className="mx-auto mb-6 flex max-w-6xl gap-2">{t("subs", "Submissions")}{t("users", "Users")}</div>
      {tab === "subs" ? <Dashboard userId={userId} /> : <Users />}
    </>
  );
}

type ProfileRow = { id: string; username: string; is_banned: boolean; created_at: string };

function Users() {
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, is_banned, created_at")
      .order("created_at", { ascending: false });
    setErr(error ? "Couldn't load users. Has the profiles table been created?" : "");
    setRows((data as ProfileRow[]) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const toggle = async (r: ProfileRow) => {
    const { error } = await supabase.from("profiles").update({ is_banned: !r.is_banned }).eq("id", r.id);
    if (error) return alert("Update failed. Is your account in the admins list?");
    setRows((cur) => cur.map((x) => (x.id === r.id ? { ...x, is_banned: !r.is_banned } : x)));
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users</h1>
        <button className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/10" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" />Refresh
        </button>
      </div>
      {loading ? (
        <p style={{ color: "var(--color-text-secondary)" }}>Loading…</p>
      ) : err ? (
        <p style={{ color: "var(--color-text-secondary)" }}>{err}</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "var(--color-text-secondary)" }}>No users yet.</p>
      ) : (
        <div className={`${glass} overflow-x-auto`}>
          <table className="w-full text-left text-sm">
            <thead style={{ color: "var(--color-text-secondary)" }}>
              <tr className="border-b border-white/10">
                <th className="p-3">Username</th><th className="p-3">Joined</th><th className="p-3">Status</th><th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="p-3 font-medium">{r.username}</td>
                  <td className="whitespace-nowrap p-3">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="p-3">{r.is_banned ? <span className="text-destructive">Banned</span> : "Active"}</td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => void toggle(r)}
                      className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold hover:bg-white/10"
                    >
                      {r.is_banned ? "Unban" : "Ban"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
