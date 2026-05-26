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
end $$;
