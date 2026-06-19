-- Purchase receipt storage and review workflow.
-- Run after business_profiles.sql.

create table if not exists public.purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  vendor text not null,
  purchase_date date not null,
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  tax_amount numeric(12, 2) check (tax_amount is null or tax_amount >= 0),
  category text not null default 'Other',
  payment_method text,
  notes text,
  file_path text not null,
  file_name text not null,
  mime_type text,
  status text not null default 'pending',
  created_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_receipts_status_check
    check (status in ('pending', 'reviewed', 'flagged'))
);

create index if not exists purchase_receipts_account_date_idx
  on public.purchase_receipts (account_id, purchase_date desc);
create index if not exists purchase_receipts_account_status_idx
  on public.purchase_receipts (account_id, status);
create index if not exists purchase_receipts_vendor_idx
  on public.purchase_receipts (vendor);

alter table public.purchase_receipts enable row level security;

drop policy if exists "Account members can read receipts" on public.purchase_receipts;
drop policy if exists "Managers can read receipts" on public.purchase_receipts;
create policy "Managers can read receipts"
on public.purchase_receipts
for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_active = true
      and profiles.role in ('owner', 'manager', 'super_admin')
      and (
        profiles.account_id = purchase_receipts.account_id
        or profiles.role = 'super_admin'
      )
  )
);

drop policy if exists "Managers can create receipts" on public.purchase_receipts;
create policy "Managers can create receipts"
on public.purchase_receipts
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_active = true
      and profiles.role in ('owner', 'manager', 'super_admin')
      and (
        profiles.account_id = purchase_receipts.account_id
        or profiles.role = 'super_admin'
      )
  )
);

drop policy if exists "Managers can update receipts" on public.purchase_receipts;
create policy "Managers can update receipts"
on public.purchase_receipts
for update
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_active = true
      and profiles.role in ('owner', 'manager', 'super_admin')
      and (
        profiles.account_id = purchase_receipts.account_id
        or profiles.role = 'super_admin'
      )
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_active = true
      and profiles.role in ('owner', 'manager', 'super_admin')
      and (
        profiles.account_id = purchase_receipts.account_id
        or profiles.role = 'super_admin'
      )
  )
);

drop policy if exists "Owners can delete receipts" on public.purchase_receipts;
create policy "Owners can delete receipts"
on public.purchase_receipts
for delete
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_active = true
      and profiles.role in ('owner', 'super_admin')
      and (
        profiles.account_id = purchase_receipts.account_id
        or profiles.role = 'super_admin'
      )
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'purchase-receipts',
  'purchase-receipts',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Account members can view receipt files" on storage.objects;
drop policy if exists "Managers can view receipt files" on storage.objects;
create policy "Managers can view receipt files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'purchase-receipts'
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_active = true
      and profiles.role in ('owner', 'manager', 'super_admin')
      and (
        profiles.account_id::text = (storage.foldername(name))[1]
        or profiles.role = 'super_admin'
      )
  )
);

drop policy if exists "Managers can upload receipt files" on storage.objects;
create policy "Managers can upload receipt files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'purchase-receipts'
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_active = true
      and profiles.role in ('owner', 'manager', 'super_admin')
      and (
        profiles.account_id::text = (storage.foldername(name))[1]
        or profiles.role = 'super_admin'
      )
  )
);

drop policy if exists "Owners can delete receipt files" on storage.objects;
create policy "Owners can delete receipt files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'purchase-receipts'
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_active = true
      and profiles.role in ('owner', 'super_admin')
      and (
        profiles.account_id::text = (storage.foldername(name))[1]
        or profiles.role = 'super_admin'
      )
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
      module_key in ('meal_prep', 'bookings', 'permits', 'proposals', 'pos', 'inventory', 'receipts', 'contacts', 'documents', 'reports')
    );
end $$;

insert into public.account_modules (account_id, module_key, enabled, billing_status)
select id, 'receipts', true, 'manual'
from public.accounts
where slug = 'zigs-kitchen'
on conflict (account_id, module_key) do update
set enabled = true, updated_at = now();
