# Feedback Modal, Hidden Admin Panel & CSV Export

## What you get
- A **Feedback** button in the sidebar and top bar that opens a frosted-glass form: Name, Category (Bug / Request / Feedback), Message. Anyone can send it, no account needed.
- A hidden page at **/audifiya-admin-panel**:
  - Signed out: a centered glass login box (email + password).
  - Signed in as an admin: a table of all submissions (Date, Name, Category, Message), newest first, plus **Export to CSV** (downloads `audifiya_leads.csv`) and **Sign Out** buttons.
- The exact SQL you paste into your own database's SQL Editor (shown below and saved in the project).

## Security change to the spec (recommended)
The spec lets any signed-in user read everything. If signups are ever on, a stranger could create an account and read all messages. So the SQL adds an `admins` list: only emails/users on that list can read, edit or delete. You add yourself with one line after creating your login. Also: turn off public signups in your Auth settings.

## SQL to paste
```sql
create table public.user_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 100),
  category text not null check (category in ('Bug','Request','Feedback')),
  message text not null check (char_length(message) between 1 and 2000),
  status text not null default 'new' check (status in ('new','read','resolved'))
);

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

grant insert on public.user_submissions to anon, authenticated;
grant select, update, delete on public.user_submissions to authenticated;
grant select on public.admins to authenticated;
grant all on public.user_submissions, public.admins to service_role;

alter table public.user_submissions enable row level security;
alter table public.admins enable row level security;

create or replace function public.is_admin(_uid uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admins where user_id = _uid) $$;

create policy "Anyone can submit" on public.user_submissions
  for insert to anon, authenticated with check (status = 'new');
create policy "Admins read" on public.user_submissions
  for select to authenticated using (public.is_admin(auth.uid()));
create policy "Admins update" on public.user_submissions
  for update to authenticated using (public.is_admin(auth.uid()));
create policy "Admins delete" on public.user_submissions
  for delete to authenticated using (public.is_admin(auth.uid()));
create policy "Admins see self" on public.admins
  for select to authenticated using (user_id = auth.uid());

-- After creating your admin login in Authentication > Users:
-- insert into public.admins (user_id)
--   select id from auth.users where email = 'you@example.com';
```

## Technical details
- `bun add @supabase/supabase-js`; `src/lib/supabaseClient.ts` with the provided URL + publishable key (safe in code). Session persisted in localStorage, client only used in browser code.
- Insert without `.select()` (anon cannot read back rows).
- `src/components/FeedbackModal.tsx` — glass styling that follows the 3 theme modes; client-side validation (zod, lengths match SQL); success/error toast via sonner (mount `<Toaster />` in `__root.tsx`).
- Feedback button added to `Sidebar.tsx` (footer) and `AppShell.tsx` (mobile top bar).
- `src/routes/audifiya-admin-panel.tsx` — `ssr: false`, `onAuthStateChange` drives login vs dashboard; checks `admins` row for self, shows "Not authorized" otherwise; head meta with `noindex`. Hidden from all nav.
- CSV: headers `Date,Name,Category,Message,Status`, every field quoted with `"` escaped as `""`, and cells starting with `= + - @` prefixed with `'` to prevent spreadsheet formula injection; Blob + temporary `<a download>`.
- SQL also saved to `supabase-setup.sql` in the project for reference.
