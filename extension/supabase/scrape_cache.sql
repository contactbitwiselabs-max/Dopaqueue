-- DopaQueue: scrape_cache table
--
-- Stores the offline-scraped transcript/genre/channel data (captured by
-- the content script at Save-time) so it survives cloud sync, not just
-- chrome.storage.local on a single device.
--
-- Run this once in your Supabase project's SQL editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run) before using
-- "Sync to Cloud" from the dashboard — until this table exists, syncing
-- the scrape cache will fail (though queue/notes/game/settings sync
-- will keep working independently, since each table syncs on its own).

create table if not exists public.scrape_cache (
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  genre text,
  channel text,
  transcript text,
  "scrapedAt" bigint,
  primary key (user_id, url)
);

alter table public.scrape_cache enable row level security;

create policy "scrape_cache_select_own" on public.scrape_cache
  for select using (auth.uid() = user_id);

create policy "scrape_cache_insert_own" on public.scrape_cache
  for insert with check (auth.uid() = user_id);

create policy "scrape_cache_update_own" on public.scrape_cache
  for update using (auth.uid() = user_id);

create policy "scrape_cache_delete_own" on public.scrape_cache
  for delete using (auth.uid() = user_id);
