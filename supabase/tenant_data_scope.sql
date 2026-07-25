-- Adds tenant/company ownership columns to operational tables created before
-- the multi-company platform model. Run after business_profiles.sql.

do $$
declare
  default_account_id uuid;
begin
  select id into default_account_id
  from public.accounts
  where slug = 'zigs-kitchen'
  order by created_at
  limit 1;

  if default_account_id is null then
    select id into default_account_id
    from public.accounts
    order by created_at
    limit 1;
  end if;

  if to_regclass('public.bookings') is not null then
    alter table public.bookings
      add column if not exists account_id uuid references public.accounts(id) on delete cascade;
    if default_account_id is not null then
      update public.bookings set account_id = default_account_id where account_id is null;
    end if;
    create index if not exists bookings_account_idx on public.bookings (account_id);
  end if;

  if to_regclass('public.permits') is not null then
    alter table public.permits
      add column if not exists account_id uuid references public.accounts(id) on delete cascade;
    if default_account_id is not null then
      update public.permits set account_id = default_account_id where account_id is null;
    end if;
    create index if not exists permits_account_idx on public.permits (account_id);
  end if;

  if to_regclass('public.documents') is not null then
    alter table public.documents
      add column if not exists account_id uuid references public.accounts(id) on delete cascade;
    if default_account_id is not null then
      update public.documents set account_id = default_account_id where account_id is null;
    end if;
    create index if not exists documents_account_idx on public.documents (account_id);
  end if;

  if to_regclass('public.inventory_items') is not null then
    alter table public.inventory_items
      add column if not exists account_id uuid references public.accounts(id) on delete cascade;
    if default_account_id is not null then
      update public.inventory_items set account_id = default_account_id where account_id is null;
    end if;
    create index if not exists inventory_items_account_idx on public.inventory_items (account_id);
  end if;

  if to_regclass('public.meal_prep_clients') is not null then
    alter table public.meal_prep_clients
      add column if not exists account_id uuid references public.accounts(id) on delete cascade;
    if default_account_id is not null then
      update public.meal_prep_clients set account_id = default_account_id where account_id is null;
    end if;
    create index if not exists meal_prep_clients_account_idx on public.meal_prep_clients (account_id);
  end if;

  if to_regclass('public.catering_proposals') is not null then
    alter table public.catering_proposals
      add column if not exists account_id uuid references public.accounts(id) on delete cascade;
    if default_account_id is not null then
      update public.catering_proposals set account_id = default_account_id where account_id is null;
    end if;
    create index if not exists catering_proposals_account_idx on public.catering_proposals (account_id);
  end if;

  if to_regclass('public.pos_orders') is not null then
    alter table public.pos_orders
      add column if not exists account_id uuid references public.accounts(id) on delete cascade;
    if default_account_id is not null then
      update public.pos_orders set account_id = default_account_id where account_id is null;
    end if;
    create index if not exists pos_orders_account_idx on public.pos_orders (account_id);
  end if;

  if to_regclass('public.pos_menu_items') is not null then
    alter table public.pos_menu_items
      add column if not exists account_id uuid references public.accounts(id) on delete cascade;
    if default_account_id is not null then
      update public.pos_menu_items set account_id = default_account_id where account_id is null;
    end if;
    create index if not exists pos_menu_items_account_idx on public.pos_menu_items (account_id);
  end if;
end $$;

-- Shared helpers keep tenant policies consistent without querying profiles
-- recursively from each table policy.
create or replace function public.current_profile_account_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select account_id from public.profiles where id = auth.uid() and is_active = true
$$;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text from public.profiles where id = auth.uid() and is_active = true
$$;

revoke all on function public.current_profile_account_id() from public;
revoke all on function public.current_profile_role() from public;
grant execute on function public.current_profile_account_id() to authenticated;
grant execute on function public.current_profile_role() to authenticated;

-- Replace legacy signed-in-user policies with company-aware policies. This
-- block safely skips module tables that have not been installed yet.
do $$
declare
  table_name text;
  policy_record record;
begin
  foreach table_name in array array[
    'bookings',
    'permits',
    'documents',
    'inventory_items',
    'meal_prep_clients',
    'catering_proposals',
    'pos_orders',
    'pos_menu_items'
  ] loop
    if to_regclass('public.' || table_name) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', table_name);

    for policy_record in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = table_name
    loop
      execute format('drop policy if exists %I on public.%I', policy_record.policyname, table_name);
    end loop;

    execute format(
      'create policy tenant_select on public.%I for select to authenticated using (public.current_profile_role() = ''super_admin'' or account_id = public.current_profile_account_id())',
      table_name
    );
    execute format(
      'create policy tenant_insert on public.%I for insert to authenticated with check (public.current_profile_role() = ''super_admin'' or (public.current_profile_role() in (''owner'', ''manager'') and account_id = public.current_profile_account_id()))',
      table_name
    );
    execute format(
      'create policy tenant_update on public.%I for update to authenticated using (public.current_profile_role() = ''super_admin'' or (public.current_profile_role() in (''owner'', ''manager'') and account_id = public.current_profile_account_id())) with check (public.current_profile_role() = ''super_admin'' or (public.current_profile_role() in (''owner'', ''manager'') and account_id = public.current_profile_account_id()))',
      table_name
    );
    execute format(
      'create policy tenant_delete on public.%I for delete to authenticated using (public.current_profile_role() = ''super_admin'' or (public.current_profile_role() = ''owner'' and account_id = public.current_profile_account_id()))',
      table_name
    );
  end loop;
end $$;

-- Child POS records inherit their company from the order, menu item, or
-- inventory item they reference.
do $$
declare
  policy_record record;
begin
  if to_regclass('public.pos_order_items') is not null then
    alter table public.pos_order_items enable row level security;
    for policy_record in select policyname from pg_policies where schemaname = 'public' and tablename = 'pos_order_items' loop
      execute format('drop policy if exists %I on public.pos_order_items', policy_record.policyname);
    end loop;
    create policy tenant_order_items_select on public.pos_order_items for select to authenticated
      using (exists (select 1 from public.pos_orders o where o.id = pos_order_id));
    create policy tenant_order_items_write on public.pos_order_items for all to authenticated
      using (exists (select 1 from public.pos_orders o where o.id = pos_order_id))
      with check (exists (select 1 from public.pos_orders o where o.id = pos_order_id));
  end if;

  if to_regclass('public.pos_menu_item_ingredients') is not null then
    alter table public.pos_menu_item_ingredients enable row level security;
    for policy_record in select policyname from pg_policies where schemaname = 'public' and tablename = 'pos_menu_item_ingredients' loop
      execute format('drop policy if exists %I on public.pos_menu_item_ingredients', policy_record.policyname);
    end loop;
    create policy tenant_recipes_select on public.pos_menu_item_ingredients for select to authenticated
      using (exists (select 1 from public.inventory_items i where i.id = inventory_item_id));
    create policy tenant_recipes_write on public.pos_menu_item_ingredients for all to authenticated
      using (public.current_profile_role() in ('super_admin', 'owner', 'manager') and exists (select 1 from public.inventory_items i where i.id = inventory_item_id))
      with check (public.current_profile_role() in ('super_admin', 'owner', 'manager') and exists (select 1 from public.inventory_items i where i.id = inventory_item_id));
  end if;
end $$;
