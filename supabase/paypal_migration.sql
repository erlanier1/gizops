-- Run once in the Supabase SQL editor before enabling PayPal in production.
alter table if exists public.meal_prep_clients
  add column if not exists paypal_order_id text,
  add column if not exists paypal_payment_link text;

alter table if exists public.pos_orders
  add column if not exists paypal_order_id text;

alter table if exists public.pos_orders
  alter column payment_method set default 'paypal_checkout';

alter table if exists public.pos_orders
  drop constraint if exists pos_orders_payment_method_check;

alter table if exists public.pos_orders
  add constraint pos_orders_payment_method_check
  check (payment_method in ('paypal_checkout', 'stripe_checkout', 'cash', 'external_card'));
