-- Timesheet HR app schema
-- Safe to re-run: drops/recreates policies before creating them.

-- Fixes an existing table from before approved_by had ON DELETE SET NULL.
-- No-op if daily_logs doesn't exist yet.
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'daily_logs') then
    alter table daily_logs drop constraint if exists daily_logs_approved_by_fkey;
    alter table daily_logs
      add constraint daily_logs_approved_by_fkey
      foreign key (approved_by) references profiles(id) on delete set null;
  end if;
end $$;

-- ── Profiles ────────────────────────────────────────────────────────────
-- One row per auth.users account. Created by the admin-invite API route,
-- never by public signup (there is no public signup in this app).
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null default 'employee' check (
    role in (
      'admin', 'employee', 'contractor', 'volunteer',
      'court_community_service', 'concession_stand', 'cleaning_staff', 'other'
    )
  ),
  status text not null default 'active' check (status in ('active', 'inactive')),
  hourly_rate numeric not null default 0,
  pay_type text not null default 'hourly' check (pay_type in ('hourly', 'salary', 'daily')),
  salary_amount numeric not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table profiles add column if not exists pay_type text not null default 'hourly';
alter table profiles add column if not exists salary_amount numeric not null default 0;
alter table profiles add column if not exists deleted_at timestamptz;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_pay_type_check'
  ) then
    alter table profiles add constraint profiles_pay_type_check
      check (pay_type in ('hourly', 'salary', 'daily'));
  end if;
end $$;

-- Widen pay_type check to include 'daily' (added for daily-wage workers)
do $$
begin
  alter table profiles drop constraint if exists profiles_pay_type_check;
  alter table profiles add constraint profiles_pay_type_check
    check (pay_type in ('hourly', 'salary', 'daily'));
end $$;

-- Widen the role check to include the additional non-admin role labels
-- (volunteer, court community service, concession stand, cleaning staff,
-- other), added after the table was first created.
do $$
begin
  alter table profiles drop constraint if exists profiles_role_check;
  alter table profiles add constraint profiles_role_check
    check (
      role in (
        'admin', 'employee', 'contractor', 'volunteer',
        'court_community_service', 'concession_stand', 'cleaning_staff', 'other'
      )
    );
end $$;

-- Security-definer helper so RLS policies can check "is this caller an admin?"
-- without recursively re-triggering RLS on profiles.
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

alter table profiles enable row level security;

drop policy if exists "profiles_select_own_or_admin" on profiles;
create policy "profiles_select_own_or_admin"
  on profiles for select
  using (id = auth.uid() or is_admin());

drop policy if exists "profiles_update_own_or_admin" on profiles;
create policy "profiles_update_own_or_admin"
  on profiles for update
  using (id = auth.uid() or is_admin());

drop policy if exists "profiles_admin_insert" on profiles;
create policy "profiles_admin_insert"
  on profiles for insert
  with check (is_admin());

-- ── Projects ────────────────────────────────────────────────────────────
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'projects_name_key'
  ) then
    alter table projects add constraint projects_name_key unique (name);
  end if;
end $$;

alter table projects enable row level security;

drop policy if exists "projects_select_authenticated" on projects;
create policy "projects_select_authenticated"
  on projects for select
  using (auth.uid() is not null);

drop policy if exists "projects_admin_write" on projects;
create policy "projects_admin_write"
  on projects for all
  using (is_admin())
  with check (is_admin());

insert into projects (name) values
  ('Cleaning'), ('ACHR Office'), ('Concession Stand')
on conflict (name) do nothing;

-- ── Holidays ────────────────────────────────────────────────────────────
create table if not exists holidays (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  name text not null
);

alter table holidays enable row level security;

drop policy if exists "holidays_select_authenticated" on holidays;
create policy "holidays_select_authenticated"
  on holidays for select
  using (auth.uid() is not null);

drop policy if exists "holidays_admin_write" on holidays;
create policy "holidays_admin_write"
  on holidays for all
  using (is_admin())
  with check (is_admin());

-- ── Daily logs ──────────────────────────────────────────────────────────
create table if not exists daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  clock_in time,
  clock_out time,
  total_hours numeric not null default 0,
  leave_type text not null default 'none' check (leave_type in ('none', 'sick', 'vacation', 'holiday', 'unpaid')),
  project_id uuid references projects(id),
  notes text not null default '',
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  approved_by uuid references profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table daily_logs enable row level security;

drop policy if exists "daily_logs_select_own_or_admin" on daily_logs;
create policy "daily_logs_select_own_or_admin"
  on daily_logs for select
  using (user_id = auth.uid() or is_admin());

drop policy if exists "daily_logs_insert_own" on daily_logs;
create policy "daily_logs_insert_own"
  on daily_logs for insert
  with check (user_id = auth.uid());

drop policy if exists "daily_logs_update_own_draft_or_admin" on daily_logs;
create policy "daily_logs_update_own_draft_or_admin"
  on daily_logs for update
  using (
    (user_id = auth.uid() and status in ('draft', 'submitted'))
    or is_admin()
  );

-- ── Notifications ───────────────────────────────────────────────────────
-- Admin-facing feed, e.g. "Jordan Lee submitted hours for 2026-06-18".
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  created_at timestamptz not null default now(),
  read boolean not null default false
);

alter table notifications enable row level security;

drop policy if exists "notifications_select_admin" on notifications;
create policy "notifications_select_admin"
  on notifications for select
  using (is_admin());

drop policy if exists "notifications_insert_authenticated" on notifications;
create policy "notifications_insert_authenticated"
  on notifications for insert
  with check (auth.uid() is not null);

drop policy if exists "notifications_update_admin" on notifications;
create policy "notifications_update_admin"
  on notifications for update
  using (is_admin());

-- Required for the admin notification bell's live updates.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table notifications;
  end if;
end $$;
