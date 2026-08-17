create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  customer_name text not null,
  customer_email text,
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  amount_paid numeric(12, 2) not null default 0 check (amount_paid >= 0 and amount_paid <= amount),
  currency text not null default 'USD',
  due_date date,
  provider text not null check (provider in ('paypal', 'stripe')),
  provider_reference text,
  payment_url text not null,
  status text not null default 'sent' check (status in ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'void')),
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.invoices
  add column if not exists amount_paid numeric(12, 2) not null default 0;

alter table public.invoices drop constraint if exists invoices_status_check;
alter table public.invoices
  add constraint invoices_status_check
  check (status in ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'void'));

alter table public.invoices drop constraint if exists invoices_amount_paid_check;
alter table public.invoices
  add constraint invoices_amount_paid_check
  check (amount_paid >= 0 and amount_paid <= amount);

create index if not exists invoices_account_idx on public.invoices (account_id);
create index if not exists invoices_created_at_idx on public.invoices (created_at desc);
create index if not exists invoices_status_idx on public.invoices (status);

alter table public.invoices enable row level security;

drop policy if exists "Users can read invoices for their account" on public.invoices;
drop policy if exists "Managers can create invoices for their account" on public.invoices;
drop policy if exists "Managers can update invoices for their account" on public.invoices;
drop policy if exists "Owners can delete invoices for their account" on public.invoices;

create policy "Users can read invoices for their account"
on public.invoices for select to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_active = true
      and (
        profiles.role = 'super_admin'
        or (profiles.account_id = invoices.account_id and profiles.role in ('owner', 'manager'))
      )
  )
);

create policy "Managers can create invoices for their account"
on public.invoices for insert to authenticated
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_active = true
      and (
        profiles.role = 'super_admin'
        or (profiles.account_id = invoices.account_id and profiles.role in ('owner', 'manager'))
      )
  )
);

create policy "Managers can update invoices for their account"
on public.invoices for update to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_active = true
      and (
        profiles.role = 'super_admin'
        or (profiles.account_id = invoices.account_id and profiles.role in ('owner', 'manager'))
      )
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_active = true
      and (
        profiles.role = 'super_admin'
        or (profiles.account_id = invoices.account_id and profiles.role in ('owner', 'manager'))
      )
  )
);

create policy "Owners can delete invoices for their account"
on public.invoices for delete to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_active = true
      and (
        profiles.role = 'super_admin'
        or (profiles.account_id = invoices.account_id and profiles.role = 'owner')
      )
  )
);
