-- DopaQueue: cloud sync tables (queue / notes / game_state / settings)
--
-- These back the "Sync to Cloud" feature in shared/sync.js. The sync
-- code upserts the in-memory objects verbatim, which use camelCase
-- keys (updatedAt, budgetMinutesUsed, savedAt, ...). Postgres folds
-- unquoted identifiers to lowercase, so the columns are declared with
-- quoted camelCase names to match the JSON shapes exactly and avoid
-- silent field drops on upsert.
--
-- Run once in the Supabase SQL editor. RLS restricts every row to its
-- owner (auth.uid() = user_id).

-- ── queue ────────────────────────────────────────────────────────────
create table if not exists public.queue (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  url text,
  title text,
  type text,
  "group" text,
  "savedAt" bigint,
  watched boolean default false,
  deleted boolean default false,
  tags jsonb,
  urgency text,
  "updatedAt" bigint,
  primary key (user_id, id)
);

-- ── notes ────────────────────────────────────────────────────────────
create table if not exists public.notes (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  "videoId" text,
  url text,
  body text,
  deleted boolean default false,
  "updatedAt" bigint,
  primary key (user_id, id)
);

-- ── game_state (single row per user) ─────────────────────────────────
create table if not exists public.game_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plant text,
  coins integer default 0,
  "budgetMinutesTotal" integer,
  "budgetMinutesUsed" integer,
  "lastReset" text,
  "lastResetDate" text,
  "notifiedZeroToday" boolean default false,
  "updatedAt" bigint
);

-- ── settings (single row per user) ───────────────────────────────────
create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  "dailyBudgetMinutes" integer,
  "reminderHours" integer,
  "aiProvider" text,
  "aiApiKey" text,
  "notificationsEnabled" boolean,
  "webhookUrl" text,
  "exportTemplate" text,
  "updatedAt" bigint
);

-- ── Row Level Security ───────────────────────────────────────────────
alter table public.queue      enable row level security;
alter table public.notes      enable row level security;
alter table public.game_state enable row level security;
alter table public.settings   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['queue','notes','game_state','settings']
  loop
    execute format($f$
      drop policy if exists "%1$s_all_own" on public.%1$I;
      create policy "%1$s_all_own" on public.%1$I
        for all using (auth.uid() = user_id)
        with check (auth.uid() = user_id);
    $f$, t);
  end loop;
end $$;
