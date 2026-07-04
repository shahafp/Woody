-- WOD Time v1 schema. Every synced table shares the envelope:
--   id uuid pk (client-generated), user_id -> auth.users,
--   created_at/updated_at timestamptz (client-stamped, LWW),
--   deleted_at timestamptz (tombstone).
-- RLS: owners only, on every table. Sync pull cursor needs (user_id, updated_at).

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.user_settings (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade unique,
  unit text not null default 'kg',
  plate_increment_kg numeric not null default 2.5,
  plate_increment_lbs numeric not null default 5,
  sound_enabled boolean not null default true,
  vibrate_enabled boolean not null default true,
  locale text not null default 'en',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create table public.lifts (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create table public.lift_maxes (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  lift_id uuid not null,
  value_kg numeric not null,
  recorded_at date not null,
  source text not null default 'manual',
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create table public.timer_presets (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  config jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create table public.wod_sheets (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  date date not null,
  title text not null default '',
  blocks jsonb not null default '[]',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create table public.workout_logs (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  performed_at date not null,
  title text not null default '',
  description text not null default '',
  timer_config jsonb,
  result_type text not null default 'none',
  result jsonb not null default '{}',
  rx boolean not null default true,
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

-- sync pull cursors
create index on public.user_settings (user_id, updated_at);
create index on public.lifts (user_id, updated_at);
create index on public.lift_maxes (user_id, updated_at);
create index on public.timer_presets (user_id, updated_at);
create index on public.wod_sheets (user_id, updated_at);
create index on public.workout_logs (user_id, updated_at);

-- domain queries
create index on public.lift_maxes (user_id, lift_id, recorded_at desc);
create index on public.workout_logs (user_id, performed_at desc);
create index on public.wod_sheets (user_id, date desc);

-- RLS: own rows only, everywhere
alter table public.profiles enable row level security;
create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

alter table public.user_settings enable row level security;
create policy "own rows" on public.user_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.lifts enable row level security;
create policy "own rows" on public.lifts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.lift_maxes enable row level security;
create policy "own rows" on public.lift_maxes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.timer_presets enable row level security;
create policy "own rows" on public.timer_presets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.wod_sheets enable row level security;
create policy "own rows" on public.wod_sheets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.workout_logs enable row level security;
create policy "own rows" on public.workout_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
