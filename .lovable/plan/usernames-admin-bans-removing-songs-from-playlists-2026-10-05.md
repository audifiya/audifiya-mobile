# Usernames, Admin Bans & Removing Songs from Playlists

## What you'll get
- **Unique usernames:** the "What should we call you?" step in onboarding becomes a username field. As you type, it shows a green check ("Username available") or red text ("Username taken"). The username is saved to your database.
- **Admin "Users" tab:** the admin panel gets two tabs, Submissions and Users. Users lists every username with its status, and each row has a Ban / Unban button.
- **Ban lockout:** a banned person sees a full-screen message that can't be closed: "Your account has been banned due to a violation of terms." The rest of the app won't open for them.
- **Remove songs:** every song row on your own playlist pages gets a trash icon. Tapping it removes that song for good.

## Important: how people get an account
Right now the app has no logins; everything lives in the browser. A username stored in the database has to belong to an account, so each visitor will get an **invisible guest account** created automatically. Nobody sees a login screen.

You need to make one switch in your database dashboard: **Authentication → Sign In / Providers → turn on "Allow anonymous sign-ins".**

People who already finished onboarding get a quick one-time username prompt the next time they open the app.

## Security fixes to your SQL
As written, the SQL would let any user unban themselves, because "manage own profile" covers the ban field too. It also lacks the grants the database needs. I'll add the corrected version below to `supabase-setup.sql` for you to run:

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null
    check (username ~ '^[a-z0-9_]{3,20}$'),
  is_banned boolean not null default false,
  created_at timestamptz not null default now()
);
grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create policy "Public read profiles" on public.profiles for select using (true);
create policy "Users create own profile" on public.profiles
  for insert to authenticated with check (auth.uid() = id and is_banned = false);
create policy "Users update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "Admins update all profiles" on public.profiles
  for update to authenticated using (public.is_admin(auth.uid()));

-- Only admins may change is_banned
create or replace function public.guard_ban() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_banned is distinct from old.is_banned and not public.is_admin(auth.uid()) then
    raise exception 'not allowed';
  end if;
  return new;
end $$;
create trigger profiles_guard_ban before update on public.profiles
  for each row execute function public.guard_ban();
```
Usernames are saved in lowercase (letters, numbers and underscores, 3–20 characters), so "Lei" and "lei" count as the same name.

## Limits to know
- The ban is enforced in the browser, like your spec describes, and the app also remembers it (`audiFiya_banned`). A determined person could get around it by clearing their browser data, which creates a new guest account. This stops casual misuse, not a determined person.
- The admin panel only works if your admin account is listed in the `admins` table.

## Technical details
- `src/lib/account.ts` (new): `ensureSession()` signs the visitor in anonymously if they have no session. `useAccount()` loads the profile and exposes `{ profile, banned, ready }`. It also exports `isUsernameAvailable(name)` (uses `.maybeSingle()`, not `.single()`) and `claimUsername(name)`, which inserts the row and shows an error if the name is taken.
- `OnboardingModal.tsx`: step 1 uses a username input with a 500ms debounced availability check and a check/X indicator. Continue is disabled until the name is available. On submit it claims the username, then writes the local profile with the username as display name. A small `UsernamePrompt` handles existing users who have a local profile but no database profile.
- `__root.tsx`: if `banned` (from the database or the saved flag) is true, show `BannedScreen` in place of the whole layout. The flag is cleared again if an admin unbans.
- `audifiya-admin-panel.tsx`: Submissions / Users tabs. Users loads `profiles` (username, is_banned, created_at) and the toggle calls `update({ is_banned: !current })`.
- `library.ts`: add `removeSongFromPlaylist(id, songId)` (writes to storage and fires the change event). `playlist.$id.tsx`: trash button on each row with `stopPropagation`, plus a toast.
- `supabase-setup.sql`: add the block above.
