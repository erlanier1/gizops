create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  category text not null default 'Dry Goods',
  unit text not null default 'each',
  quantity_on_hand numeric not null default 0,
  par_level numeric not null default 0,
  reorder_quantity numeric not null default 0,
  vendor text,
  storage_location text,
  expiration_date date,
  cost_per_unit numeric,
  sku text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.inventory_items
  add column if not exists item_name text,
  add column if not exists category text not null default 'Dry Goods',
  add column if not exists unit text not null default 'each',
  add column if not exists quantity_on_hand numeric not null default 0,
  add column if not exists par_level numeric not null default 0,
  add column if not exists reorder_quantity numeric not null default 0,
  add column if not exists vendor text,
  add column if not exists storage_location text,
  add column if not exists expiration_date date,
  add column if not exists cost_per_unit numeric,
  add column if not exists sku text,
  add column if not exists notes text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists inventory_items_category_idx on public.inventory_items (category);
create index if not exists inventory_items_item_name_idx on public.inventory_items (item_name);
create index if not exists inventory_items_expiration_date_idx on public.inventory_items (expiration_date);

alter table public.inventory_items enable row level security;

create policy "Inventory is readable by signed-in users"
on public.inventory_items
for select
to authenticated
using (true);

create policy "Managers can create inventory items"
on public.inventory_items
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

create policy "Managers can update inventory items"
on public.inventory_items
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

create policy "Owners can delete inventory items"
on public.inventory_items
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
