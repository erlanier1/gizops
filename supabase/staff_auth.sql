-- Simplified staff authentication, locations/events, clock-ins, and audit trail.
create extension if not exists pgcrypto;

create table if not exists public.staff_locations (
  id uuid primary key default gen_random_uuid(), account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null, type text not null check (type in ('restaurant','food_truck')),
  is_active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.staff_events (
  id uuid primary key default gen_random_uuid(), account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null, client text, address text, starts_at timestamptz not null, ends_at timestamptz,
  status text not null default 'upcoming' check (status in ('upcoming','active','completed','cancelled')),
  created_at timestamptz not null default now()
);
create table if not exists public.staff_employees (
  id uuid primary key default gen_random_uuid(), account_id uuid not null references public.accounts(id) on delete cascade,
  employee_code text not null, full_name text not null, email text, mobile text,
  role text not null default 'staff' check (role in ('staff','lead','manager')),
  location_id uuid references public.staff_locations(id) on delete set null,
  password_hash text, pin_hash text, must_set_pin boolean not null default true,
  failed_attempts integer not null default 0, locked_until timestamptz, is_active boolean not null default true,
  credential_version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(account_id, employee_code)
);
create table if not exists public.staff_event_assignments (
  event_id uuid references public.staff_events(id) on delete cascade,
  employee_id uuid references public.staff_employees(id) on delete cascade, primary key(event_id, employee_id)
);
create table if not exists public.staff_time_entries (
  id uuid primary key default gen_random_uuid(), account_id uuid not null references public.accounts(id) on delete cascade,
  employee_id uuid not null references public.staff_employees(id) on delete cascade,
  location_id uuid references public.staff_locations(id), event_id uuid references public.staff_events(id),
  device_type text not null check (device_type in ('personal','trusted')), clocked_in_at timestamptz not null default now(), clocked_out_at timestamptz
);
create table if not exists public.staff_audit_log (
  id bigint generated always as identity primary key, account_id uuid references public.accounts(id) on delete cascade,
  employee_id uuid references public.staff_employees(id) on delete set null, actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null, success boolean not null default true, ip_address text, user_agent text, details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists staff_employee_lookup_idx on public.staff_employees(account_id, employee_code);
create index if not exists staff_events_today_idx on public.staff_events(account_id, starts_at);
create index if not exists staff_time_open_idx on public.staff_time_entries(employee_id, clocked_out_at);
alter table public.staff_locations enable row level security;
alter table public.staff_events enable row level security;
alter table public.staff_employees enable row level security;
alter table public.staff_event_assignments enable row level security;
alter table public.staff_time_entries enable row level security;
alter table public.staff_audit_log enable row level security;
-- These tables are intentionally server-only. All access is tenant-checked in API routes using the service role.
