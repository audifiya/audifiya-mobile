# Database Playlist Sharing with 7-Day Expiry

## What you'll get
- The Share button on a playlist page saves the playlist's song list to your database and copies a short link (`/share/<id>`). You'll see a toast: "Playlist link copied! Valid for 7 days."
- Anyone who opens the link gets the full songs (cover art, artists, audio) loaded fresh, and playback starts right away.
- Links older than 7 days (or that don't exist) show a Liquid Glass screen: "This playlist link has expired."

## 1. Database table (SQL for you to run)
Your app uses your own database project, so I'll add this SQL to `supabase-setup.sql` for you to paste into its SQL editor:

```sql
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
```
The insert rule stops people from creating links that never expire. A link only works if you know its random ID.

## 2. Sending (playlist page)
- The current Share button builds a long encoded link. It will switch to: collect song IDs, save them to `shared_playlists` and get back the new `id`, then copy `${origin}/share/${id}`.
- Success shows a toast. If the database fails, an error toast appears. If copying fails, the link is shown so you can copy it yourself.
- Empty playlists can't be shared, and the button is disabled for them.

## 3. Receiving (`/share/$id`)
- New page, loaded only in the browser (`ssr: false`), with its own title and description.
- Steps: look up the row → if it's missing or `new Date() > expires_at`, show the expired screen with a "Go home" button.
- Fill in song details through JioSaavn `GET /api/songs?ids=id1,id2,...` (sent in groups of 50). If any songs fail, fall back to `fetchSongById` for each, and skip IDs that still don't resolve. The order of the original playlist is kept.
- Autoplay: call `playContext(songs, 0, "playlist")` as soon as the songs arrive. Browsers often block sound until the person taps something, so the page also shows the song list with a big Play button. If autoplay gets blocked, tapping it starts playback.
- Add a "Save to Library" button that copies the shared songs into a local playlist.

## Technical details
- `src/lib/jiosaavn.ts`: add `fetchSongsByIds(ids: string[]): Promise<JSSong[]>`.
- `src/lib/share.ts` (new): `createShareLink(songIds)` and `loadSharedPlaylist(id)`. Both use the existing `supabaseClient.ts`, and incoming IDs are checked with zod as a UUID.
- `src/routes/playlist.$id.tsx`: replace the token-based share handler. Old token import links keep working.
- `src/routes/share.$id.tsx` (new): page states are loading, expired, ready, and error. Song titles are cleaned with `decodeEntities`.
- `supabase-setup.sql`: add the SQL block above.
- Toasts use the sonner `<Toaster />` that's already mounted.
