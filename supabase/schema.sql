-- Fitness App database schema.
-- Paste this whole file into Supabase: SQL Editor -> New query -> Run.
-- Safe to run more than once.
--
-- Every table has row level security: a signed-in user can only ever
-- read or write rows where user_id is their own account.

-- Morning weigh-ins
create table if not exists public.weigh_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  measured_on date not null,
  weight_kg numeric(6, 2) not null check (weight_kg > 0),
  body_fat_pct numeric(4, 1) check (body_fat_pct between 0 and 100),
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, measured_on)
);

-- Workouts: imported from Apple Health, or logged in the app
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  activity text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_min numeric(7, 2),
  active_kcal numeric(8, 2),
  distance_km numeric(8, 3),
  avg_hr numeric(5, 1),
  max_hr numeric(5, 1),
  source text not null default 'app',
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, started_at, activity)
);

-- One row per day of Apple Health activity totals
create table if not exists public.daily_metrics (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  steps integer,
  active_kcal numeric(8, 2),
  resting_hr numeric(5, 1),
  hrv_ms numeric(6, 1),
  vo2max numeric(5, 2),
  sleep_hours numeric(4, 2),
  primary key (user_id, day)
);

-- Per-user preferences
create table if not exists public.profiles (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  weight_unit text not null default 'lb' check (weight_unit in ('lb', 'kg')),
  goal_weight_kg numeric(6, 2),
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['weigh_ins', 'workouts', 'daily_metrics', 'profiles'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

create index if not exists workouts_user_started on public.workouts (user_id, started_at desc);
create index if not exists weigh_ins_user_day on public.weigh_ins (user_id, measured_on desc);
