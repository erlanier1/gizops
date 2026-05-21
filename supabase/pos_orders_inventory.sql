create table if not exists public.pos_menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Entrees',
  price numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pos_menu_items
  add column if not exists name text,
  add column if not exists category text not null default 'Entrees',
  add column if not exists price numeric not null default 0,
  add column if not exists active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.pos_menu_item_ingredients (
  id uuid primary key default gen_random_uuid(),
  pos_menu_item_id text not null,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity_per_item numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (pos_menu_item_id, inventory_item_id)
);

alter table public.pos_menu_item_ingredients
  add column if not exists pos_menu_item_id text,
  add column if not exists inventory_item_id uuid,
  add column if not exists quantity_per_item numeric not null default 0,
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.pos_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_name text,
  source text not null default 'food_truck',
  status text not null default 'checkout_pending',
  payment_method text not null default 'stripe_checkout',
  subtotal numeric not null default 0,
  tax numeric not null default 0,
  total numeric not null default 0,
  stripe_checkout_session_id text,
  inventory_deducted boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pos_orders_source_check check (source in ('food_truck', 'catering', 'meal_prep', 'other')),
  constraint pos_orders_status_check check (status in ('checkout_pending', 'paid', 'cancelled', 'refunded')),
  constraint pos_orders_payment_method_check check (payment_method in ('stripe_checkout', 'cash', 'external_card'))
);

alter table public.pos_orders
  add column if not exists order_number text,
  add column if not exists customer_name text,
  add column if not exists source text not null default 'food_truck',
  add column if not exists status text not null default 'checkout_pending',
  add column if not exists payment_method text not null default 'stripe_checkout',
  add column if not exists subtotal numeric not null default 0,
  add column if not exists tax numeric not null default 0,
  add column if not exists total numeric not null default 0,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists inventory_deducted boolean not null default false,
  add column if not exists paid_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.pos_order_items (
  id uuid primary key default gen_random_uuid(),
  pos_order_id uuid not null references public.pos_orders(id) on delete cascade,
  pos_menu_item_id text,
  item_name text not null,
  unit_price numeric not null default 0,
  quantity integer not null default 1,
  line_total numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.pos_order_items
  add column if not exists pos_order_id uuid,
  add column if not exists pos_menu_item_id text,
  add column if not exists item_name text,
  add column if not exists unit_price numeric not null default 0,
  add column if not exists quantity integer not null default 1,
  add column if not exists line_total numeric not null default 0,
  add column if not exists created_at timestamptz not null default now();

create index if not exists pos_menu_items_active_idx on public.pos_menu_items (active);
create index if not exists pos_orders_status_idx on public.pos_orders (status);
create index if not exists pos_orders_created_at_idx on public.pos_orders (created_at);
create index if not exists pos_order_items_order_idx on public.pos_order_items (pos_order_id);
create index if not exists pos_menu_item_ingredients_menu_idx on public.pos_menu_item_ingredients (pos_menu_item_id);

alter table public.pos_menu_items enable row level security;
alter table public.pos_menu_item_ingredients enable row level security;
alter table public.pos_orders enable row level security;
alter table public.pos_order_items enable row level security;

create policy "POS menu items are readable by signed-in users"
on public.pos_menu_items for select to authenticated using (true);

create policy "POS recipes are readable by signed-in users"
on public.pos_menu_item_ingredients for select to authenticated using (true);

create policy "POS orders are readable by signed-in users"
on public.pos_orders for select to authenticated using (true);

create policy "POS order items are readable by signed-in users"
on public.pos_order_items for select to authenticated using (true);

create policy "Managers can manage POS menu items"
on public.pos_menu_items for all to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('owner', 'manager', 'super_admin')
      and profiles.is_active = true
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('owner', 'manager', 'super_admin')
      and profiles.is_active = true
  )
);

create policy "Managers can manage POS recipes"
on public.pos_menu_item_ingredients for all to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('owner', 'manager', 'super_admin')
      and profiles.is_active = true
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('owner', 'manager', 'super_admin')
      and profiles.is_active = true
  )
);

create policy "POS operators can manage POS orders"
on public.pos_orders for all to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('staff', 'manager', 'owner', 'super_admin')
      and profiles.is_active = true
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('staff', 'manager', 'owner', 'super_admin')
      and profiles.is_active = true
  )
);

create policy "POS operators can manage POS order items"
on public.pos_order_items for all to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('staff', 'manager', 'owner', 'super_admin')
      and profiles.is_active = true
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('staff', 'manager', 'owner', 'super_admin')
      and profiles.is_active = true
  )
);
