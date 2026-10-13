-- Step 2: strength workouts and food tracking.
-- Paste this whole file into Supabase: SQL Editor -> New query -> Run.
-- Safe to run more than once.

-- A lifting session ("Push day", "Legs", ...)
create table if not exists public.lift_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  performed_on date not null,
  name text,
  note text,
  created_at timestamptz not null default now()
);

-- One row per set
create table if not exists public.lift_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  session_id uuid not null references public.lift_sessions on delete cascade,
  exercise text not null,
  position integer not null default 0,
  reps integer not null check (reps >= 0),
  weight_kg numeric(6, 2) not null default 0 check (weight_kg >= 0),
  created_at timestamptz not null default now()
);

-- Your personal food library, nutrition per one serving
create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  brand text,
  serving text not null default '1 serving',
  kcal numeric(7, 1) not null default 0,
  protein_g numeric(6, 1) not null default 0,
  carbs_g numeric(6, 1) not null default 0,
  fat_g numeric(6, 1) not null default 0,
  created_at timestamptz not null default now()
);

-- What you ate. Nutrition is copied at log time so editing a food later
-- does not rewrite history.
create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  eaten_on date not null,
  meal text not null default 'Snacks',
  food_id uuid references public.foods on delete set null,
  name text not null,
  servings numeric(6, 2) not null default 1 check (servings > 0),
  kcal numeric(7, 1) not null default 0,
  protein_g numeric(6, 1) not null default 0,
  carbs_g numeric(6, 1) not null default 0,
  fat_g numeric(6, 1) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists kcal_target integer;
alter table public.profiles add column if not exists protein_target_g integer;
alter table public.profiles add column if not exists carbs_target_g integer;
alter table public.profiles add column if not exists fat_target_g integer;

alter table public.lift_sessions enable row level security;
drop policy if exists "own rows" on public.lift_sessions;
create policy "own rows" on public.lift_sessions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.lift_sets enable row level security;
drop policy if exists "own rows" on public.lift_sets;
create policy "own rows" on public.lift_sets for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.foods enable row level security;
drop policy if exists "own rows" on public.foods;
create policy "own rows" on public.foods for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.food_logs enable row level security;
drop policy if exists "own rows" on public.food_logs;
create policy "own rows" on public.food_logs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists lift_sessions_user_day on public.lift_sessions (user_id, performed_on desc);
create index if not exists lift_sets_session on public.lift_sets (session_id, position);
create index if not exists lift_sets_user_exercise on public.lift_sets (user_id, exercise);
create index if not exists food_logs_user_day on public.food_logs (user_id, eaten_on);
