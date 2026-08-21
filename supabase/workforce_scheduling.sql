-- Manager scheduling and time-entry approval.
create table if not exists public.staff_schedules (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  employee_id uuid not null references public.staff_employees(id) on delete cascade,
  location_id uuid references public.staff_locations(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_schedule_valid_range check (ends_at > starts_at)
);

create index if not exists staff_schedules_account_date_idx on public.staff_schedules(account_id, starts_at);
alter table public.staff_schedules enable row level security;

alter table public.staff_time_entries add column if not exists approval_status text not null default 'pending';
alter table public.staff_time_entries add column if not exists approved_by uuid references public.profiles(id) on delete set null;
alter table public.staff_time_entries add column if not exists approved_at timestamptz;
alter table public.staff_time_entries add column if not exists manager_note text;

do $$ begin
  alter table public.staff_time_entries add constraint staff_time_approval_status_check check (approval_status in ('pending','approved','rejected'));
exception when duplicate_object then null;
end $$;

-- Workforce tables remain server-only; tenant and role checks are enforced by API routes.
