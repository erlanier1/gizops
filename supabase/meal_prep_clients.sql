create table if not exists public.meal_prep_clients (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  email text not null,
  phone text,
  plan text not null default 'weekly_family',
  child_name text,
  start_date date,
  delivery_address text,
  delivery_window text,
  meals_per_week integer not null default 5,
  dietary_notes text,
  allergies text,
  deposit_amount numeric not null default 0,
  payment_status text not null default 'pending',
  stripe_checkout_session_id text,
  stripe_payment_link text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meal_prep_clients_plan_check check (
    plan in ('weekly_single', 'weekly_family', 'corporate', 'daycare')
  ),
  constraint meal_prep_clients_payment_status_check check (
    payment_status in ('pending', 'deposit_paid', 'invoiced', 'paid', 'cancelled')
  ),
  constraint meal_prep_clients_status_check check (
    status in ('active', 'paused', 'cancelled')
  )
);

alter table public.meal_prep_clients
  add column if not exists client_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists plan text not null default 'weekly_family',
  add column if not exists child_name text,
  add column if not exists start_date date,
  add column if not exists delivery_address text,
  add column if not exists delivery_window text,
  add column if not exists meals_per_week integer not null default 5,
  add column if not exists dietary_notes text,
  add column if not exists allergies text,
  add column if not exists deposit_amount numeric not null default 0,
  add column if not exists payment_status text not null default 'pending',
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_link text,
  add column if not exists status text not null default 'active',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists meal_prep_clients_email_idx on public.meal_prep_clients (email);
create index if not exists meal_prep_clients_plan_idx on public.meal_prep_clients (plan);
create index if not exists meal_prep_clients_start_date_idx on public.meal_prep_clients (start_date);
create index if not exists meal_prep_clients_payment_status_idx on public.meal_prep_clients (payment_status);

alter table public.meal_prep_clients enable row level security;

create policy "Meal prep clients are readable by signed-in users"
on public.meal_prep_clients
for select
to authenticated
using (true);

create policy "Managers can create meal prep clients"
on public.meal_prep_clients
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('owner', 'manager', 'super_admin')
      and profiles.is_active = true
  )
);

create policy "Managers can update meal prep clients"
on public.meal_prep_clients
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('owner', 'manager', 'super_admin')
      and profiles.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('owner', 'manager', 'super_admin')
      and profiles.is_active = true
  )
);

create policy "Owners can delete meal prep clients"
on public.meal_prep_clients
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('owner', 'super_admin')
      and profiles.is_active = true
  )
);
