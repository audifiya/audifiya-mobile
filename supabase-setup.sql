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

-- Shared playlist links (7-day expiry)
create table public.shared_playlists (
  id uuid primary key default gen_random_uuid(),
  song_ids text[] not null check (array_length(song_ids,1) between 1 and 500),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);
grant select, insert on public.shared_playlists to anon, authenticated;
grant all on public.shared_playlists to service_role;
alter table public.shared_playlists enable row level security;
create policy "Anyone can share" on public.shared_playlists
  for insert to anon, authenticated
  with check (expires_at <= now() + interval '7 days 1 minute');
create policy "Anyone can read" on public.shared_playlists
  for select to anon, authenticated using (true);

-- Profiles: unique usernames + admin ban flag
-- Also enable: Authentication > Sign In / Providers > "Allow anonymous sign-ins"
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
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
