create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_contact_name text,
  owner_contact_email text,
  industry text not null default 'food_service',
  label_overrides jsonb not null default '{}'::jsonb,
  billing_provider text not null default 'stripe',
  billing_status text not null default 'manual',
  plan_name text,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_payment_link text,
  square_location_id text,
  paypal_merchant_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_industry_check check (
    industry in ('food_service', 'beauty', 'general_service')
  ),
  constraint accounts_billing_provider_check check (
    billing_provider in ('stripe', 'square', 'paypal', 'manual')
  ),
  constraint accounts_billing_status_check check (
    billing_status in ('manual', 'trialing', 'active', 'past_due', 'canceled')
  )
);

alter table public.accounts
  add column if not exists owner_contact_name text,
  add column if not exists owner_contact_email text,
  add column if not exists industry text not null default 'food_service',
  add column if not exists label_overrides jsonb not null default '{}'::jsonb,
  add column if not exists billing_provider text not null default 'stripe',
  add column if not exists billing_status text not null default 'manual',
  add column if not exists plan_name text,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_payment_link text,
  add column if not exists square_location_id text,
  add column if not exists paypal_merchant_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'accounts_industry_check'
      and conrelid = 'public.accounts'::regclass
  ) then
    alter table public.accounts
      add constraint accounts_industry_check check (
        industry in ('food_service', 'beauty', 'general_service')
      );
  end if;
end $$;

alter table public.profiles
  add column if not exists account_id uuid references public.accounts(id) on delete set null;

create table if not exists public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.accounts(id) on delete cascade,
  business_name text not null,
  legal_name text,
  contact_email text,
  contact_phone text,
  website text,
  address text,
  city text,
  state text,
  postal_code text,
  brand_tagline text,
  proposal_footer text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.account_modules (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  module_key text not null,
  enabled boolean not null default false,
  plan_name text,
  billing_status text not null default 'manual',
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, module_key),
  constraint account_modules_module_key_check check (
    module_key in ('meal_prep', 'bookings', 'permits', 'proposals', 'pos', 'inventory', 'contacts', 'documents', 'reports')
  ),
  constraint account_modules_billing_status_check check (
    billing_status in ('manual', 'trialing', 'active', 'past_due', 'canceled')
  )
);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'account_modules_module_key_check'
      and conrelid = 'public.account_modules'::regclass
  ) then
    alter table public.account_modules drop constraint account_modules_module_key_check;
  end if;

  alter table public.account_modules
    add constraint account_modules_module_key_check check (
      module_key in ('meal_prep', 'bookings', 'permits', 'proposals', 'pos', 'inventory', 'contacts', 'documents', 'reports')
    );
end $$;

alter table public.accounts enable row level security;
alter table public.business_profiles enable row level security;
alter table public.account_modules enable row level security;

create policy "Super admins can create accounts"
on public.accounts
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'super_admin'
      and profiles.is_active = true
  )
);

create policy "Users can read their account"
on public.accounts
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.account_id = accounts.id
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

create policy "Owners can update their account"
on public.accounts
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.account_id = accounts.id
      and profiles.role in ('owner', 'super_admin')
      and profiles.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.account_id = accounts.id
      and profiles.role in ('owner', 'super_admin')
      and profiles.is_active = true
  )
);

create policy "Super admins can manage all accounts"
on public.accounts
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'super_admin'
      and profiles.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'super_admin'
      and profiles.is_active = true
  )
);

create policy "Users can read their business profile"
on public.business_profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.account_id = business_profiles.account_id
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

create policy "Owners can upsert their business profile"
on public.business_profiles
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.account_id = business_profiles.account_id
      and profiles.role in ('owner', 'super_admin')
      and profiles.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.account_id = business_profiles.account_id
      and profiles.role in ('owner', 'super_admin')
      and profiles.is_active = true
  )
);

create policy "Users can read their account modules"
on public.account_modules
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.account_id = account_modules.account_id
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

create policy "Super admins can manage account modules"
on public.account_modules
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'super_admin'
      and profiles.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'super_admin'
      and profiles.is_active = true
  )
);
