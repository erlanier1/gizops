-- Run after business_profiles.sql.
-- This creates Zig's Kitchen as the first company/tenant and enables all modules.

insert into public.accounts (
  name,
  slug,
  industry,
  owner_contact_name,
  owner_contact_email,
  is_active
)
values (
  'Zig''s Kitchen',
  'zigs-kitchen',
  'food_service',
  null,
  null,
  true
)
on conflict (slug) do update
set
  name = excluded.name,
  industry = excluded.industry,
  is_active = true,
  updated_at = now();

insert into public.business_profiles (
  account_id,
  business_name,
  legal_name,
  brand_tagline,
  proposal_footer
)
select
  accounts.id,
  'Zig''s Kitchen',
  'Zig''s Kitchen',
  'Operations built for food truck operators',
  'Thank you,' || chr(10) || 'Zig''s Kitchen'
from public.accounts
where accounts.slug = 'zigs-kitchen'
on conflict (account_id) do update
set
  business_name = excluded.business_name,
  legal_name = excluded.legal_name,
  brand_tagline = excluded.brand_tagline,
  proposal_footer = excluded.proposal_footer,
  updated_at = now();

insert into public.account_modules (
  account_id,
  module_key,
  enabled,
  billing_status
)
select
  accounts.id,
  module_key,
  true,
  'manual'
from public.accounts
cross join (
  values
    ('meal_prep'),
    ('bookings'),
    ('permits'),
    ('proposals'),
    ('pos'),
    ('inventory'),
    ('receipts'),
    ('contacts'),
    ('documents'),
    ('reports')
) as modules(module_key)
where accounts.slug = 'zigs-kitchen'
on conflict (account_id, module_key) do update
set
  enabled = true,
  billing_status = 'manual',
  updated_at = now();

-- After you know your Supabase auth user id, run this with that id to attach
-- your login to Zig's Kitchen while keeping platform-wide super admin access:
--
-- update public.profiles
-- set account_id = (select id from public.accounts where slug = 'zigs-kitchen'),
--     role = 'super_admin',
--     is_active = true
-- where id = 'YOUR_AUTH_USER_ID';
