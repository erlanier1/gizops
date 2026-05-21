create table if not exists public.catering_proposals (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete set null,
  proposal_number text not null unique,
  client_name text not null,
  client_email text,
  client_phone text,
  event_date date,
  event_time text,
  event_location text,
  guest_count integer,
  menu_summary text,
  service_terms text,
  total_amount numeric not null default 0,
  deposit_amount numeric not null default 0,
  due_date date,
  status text not null default 'draft',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catering_proposals_status_check check (
    status in ('draft', 'sent', 'accepted', 'declined', 'expired')
  )
);

create index if not exists catering_proposals_booking_id_idx on public.catering_proposals (booking_id);
create index if not exists catering_proposals_client_name_idx on public.catering_proposals (client_name);
create index if not exists catering_proposals_event_date_idx on public.catering_proposals (event_date);
create index if not exists catering_proposals_status_idx on public.catering_proposals (status);

alter table public.catering_proposals enable row level security;

create policy "Catering proposals are readable by signed-in users"
on public.catering_proposals
for select
to authenticated
using (true);

create policy "Managers can create catering proposals"
on public.catering_proposals
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

create policy "Managers can update catering proposals"
on public.catering_proposals
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

create policy "Owners can delete catering proposals"
on public.catering_proposals
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
