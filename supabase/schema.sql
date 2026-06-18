-- Выполните в Supabase: SQL Editor → New query → Run

create table if not exists public.pools (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  volume integer not null default 25000,
  treatment_type text not null default 'chlorine' check (treatment_type in ('chlorine', 'peroxide')),
  location jsonb not null default '{"address":"","lat":null,"lng":null}'::jsonb,
  problem_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pool_id uuid not null references public.pools (id) on delete cascade,
  ph numeric not null,
  chlorine numeric not null,
  temperature numeric not null,
  measured_at timestamptz not null default now()
);

create table if not exists public.chemistry_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pool_id uuid not null references public.pools (id) on delete cascade,
  chemical text not null,
  amount numeric not null,
  unit text not null default 'г',
  comment text not null default '',
  logged_at timestamptz not null default now()
);

alter table public.pools enable row level security;
alter table public.measurements enable row level security;
alter table public.chemistry_log enable row level security;

create policy "pools_select" on public.pools for select using (auth.uid() = user_id);
create policy "pools_insert" on public.pools for insert with check (auth.uid() = user_id);
create policy "pools_update" on public.pools for update using (auth.uid() = user_id);
create policy "pools_delete" on public.pools for delete using (auth.uid() = user_id);

create policy "measurements_select" on public.measurements for select using (auth.uid() = user_id);
create policy "measurements_insert" on public.measurements for insert with check (auth.uid() = user_id);
create policy "measurements_delete" on public.measurements for delete using (auth.uid() = user_id);

create policy "chemistry_select" on public.chemistry_log for select using (auth.uid() = user_id);
create policy "chemistry_insert" on public.chemistry_log for insert with check (auth.uid() = user_id);
create policy "chemistry_delete" on public.chemistry_log for delete using (auth.uid() = user_id);
