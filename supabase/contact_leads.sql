create table if not exists public.contact_leads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  source text not null default 'website',
  status text not null default 'new',
  contact_name text not null,
  email text not null,
  phone text,
  company_name text,
  service_interest text,
  message text,
  consent_to_contact boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_leads_status_check check (status in ('new', 'contacted', 'qualified', 'converted', 'closed')),
  constraint contact_leads_source_check check (source in ('website', 'manual', 'import', 'event', 'referral'))
);

create index if not exists contact_leads_account_idx on public.contact_leads (account_id);
create index if not exists contact_leads_created_at_idx on public.contact_leads (created_at desc);
create index if not exists contact_leads_status_idx on public.contact_leads (status);
create index if not exists contact_leads_email_idx on public.contact_leads (email);

alter table public.contact_leads enable row level security;

create policy "Users can read contact leads for their account"
on public.contact_leads
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.account_id = contact_leads.account_id
      and profiles.role in ('owner', 'manager', 'super_admin')
      and profiles.is_active = true
  )
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'super_admin'
      and profiles.is_active = true
  )
);

create policy "Managers can update contact leads for their account"
on public.contact_leads
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.account_id = contact_leads.account_id
      and profiles.role in ('owner', 'manager', 'super_admin')
      and profiles.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.account_id = contact_leads.account_id
      and profiles.role in ('owner', 'manager', 'super_admin')
      and profiles.is_active = true
  )
);

create policy "Owners can delete contact leads for their account"
on public.contact_leads
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.account_id = contact_leads.account_id
      and profiles.role in ('owner', 'super_admin')
      and profiles.is_active = true
  )
);
