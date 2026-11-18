-- SONO booking test database. All records stay server-only until the payment flow is reviewed.
create table public.sono_tours (
  code text primary key,
  title_ja text not null,
  title_en text not null,
  title_fr text not null,
  price_jpy integer not null check (price_jpy > 0),
  duration_minutes integer not null check (duration_minutes between 30 and 600),
  max_guests integer not null check (max_guests between 1 and 12),
  enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.sono_slots (
  id uuid primary key default gen_random_uuid(),
  tour_code text not null references public.sono_tours(code) on update cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'closed' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  constraint sono_slot_time_order check (ends_at > starts_at),
  constraint sono_slot_unique_start unique (tour_code, starts_at)
);

create index sono_slots_start_idx on public.sono_slots (starts_at);

create table public.sono_reservations (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.sono_slots(id),
  guest_name text not null check (length(guest_name) between 1 and 120),
  guest_email text not null check (length(guest_email) between 3 and 254),
  guests integer not null check (guests between 1 and 12),
  amount_jpy integer not null check (amount_jpy > 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'expired', 'cancelled', 'refunded')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  constraint sono_confirmed_time check (status <> 'confirmed' or confirmed_at is not null)
);

-- A pending Checkout or confirmed booking reserves the whole private tour slot.
-- A missing webhook leaves the slot blocked for review rather than selling it twice.
create unique index sono_one_active_reservation_per_slot
  on public.sono_reservations (slot_id)
  where status in ('pending', 'confirmed');

create table public.sono_stripe_events (
  event_id text primary key,
  event_type text not null,
  checkout_session_id text not null,
  processed_at timestamptz not null default now()
);

alter table public.sono_tours enable row level security;
alter table public.sono_slots enable row level security;
alter table public.sono_reservations enable row level security;
alter table public.sono_stripe_events enable row level security;

revoke all on table public.sono_tours, public.sono_slots, public.sono_reservations, public.sono_stripe_events from anon, authenticated;
grant select, insert, update, delete on table public.sono_tours, public.sono_slots, public.sono_reservations, public.sono_stripe_events to service_role;

create function public.sono_claim_slot(p_slot_id uuid, p_guest_name text, p_guest_email text, p_guests integer)
returns table (reservation_id uuid, amount_jpy integer)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_slot public.sono_slots%rowtype;
  v_tour public.sono_tours%rowtype;
begin
  if length(trim(coalesce(p_guest_name, ''))) not between 1 and 120
     or length(trim(coalesce(p_guest_email, ''))) not between 3 and 254
     or p_guests is null or p_guests < 1 then
    raise exception 'invalid_guest_details';
  end if;

  select * into v_slot from public.sono_slots where id = p_slot_id for update;
  if not found or v_slot.status <> 'open' or v_slot.starts_at <= now() + interval '24 hours' then
    raise exception 'slot_unavailable';
  end if;
  select * into v_tour from public.sono_tours where code = v_slot.tour_code;
  if not found or not v_tour.enabled or p_guests > v_tour.max_guests then
    raise exception 'tour_unavailable';
  end if;
  if exists (select 1 from public.sono_reservations where slot_id = p_slot_id and status in ('pending', 'confirmed')) then
    raise exception 'slot_unavailable';
  end if;

  return query
    insert into public.sono_reservations (slot_id, guest_name, guest_email, guests, amount_jpy)
    values (p_slot_id, trim(p_guest_name), lower(trim(p_guest_email)), p_guests, v_tour.price_jpy)
    returning id, public.sono_reservations.amount_jpy;
end;
$$;

create function public.sono_attach_checkout(p_reservation_id uuid, p_checkout_session_id text)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  update public.sono_reservations
    set stripe_checkout_session_id = p_checkout_session_id
    where id = p_reservation_id and status = 'pending' and stripe_checkout_session_id is null;
  return found;
end;
$$;

create function public.sono_release_pending(p_reservation_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  update public.sono_reservations
    set status = 'expired'
    where id = p_reservation_id and status = 'pending' and stripe_checkout_session_id is null;
  return found;
end;
$$;

create function public.sono_confirm_checkout(
  p_event_id text,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_amount_jpy integer,
  p_currency text,
  p_payment_status text
)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_reservation public.sono_reservations%rowtype;
begin
  select * into v_reservation from public.sono_reservations
    where stripe_checkout_session_id = p_checkout_session_id for update;
  if not found or p_currency <> 'jpy' or p_payment_status <> 'paid'
     or nullif(p_payment_intent_id, '') is null
     or v_reservation.amount_jpy <> p_amount_jpy then
    raise exception 'checkout_mismatch';
  end if;
  if v_reservation.status not in ('pending', 'confirmed') then
    raise exception 'reservation_not_confirmable';
  end if;
  insert into public.sono_stripe_events (event_id, event_type, checkout_session_id)
    values (p_event_id, 'checkout.session.completed', p_checkout_session_id)
    on conflict (event_id) do nothing;
  if v_reservation.status = 'confirmed' then return true; end if;
  update public.sono_reservations
    set status = 'confirmed', confirmed_at = now(), stripe_payment_intent_id = p_payment_intent_id
    where id = v_reservation.id;
  return true;
end;
$$;

create function public.sono_expire_checkout(p_event_id text, p_checkout_session_id text)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_reservation public.sono_reservations%rowtype;
begin
  select * into v_reservation from public.sono_reservations
    where stripe_checkout_session_id = p_checkout_session_id for update;
  if not found then return false; end if;
  insert into public.sono_stripe_events (event_id, event_type, checkout_session_id)
    values (p_event_id, 'checkout.session.expired', p_checkout_session_id)
    on conflict (event_id) do nothing;
  if v_reservation.status = 'pending' then
    update public.sono_reservations set status = 'expired' where id = v_reservation.id;
  end if;
  return true;
end;
$$;

revoke all on function public.sono_claim_slot(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.sono_attach_checkout(uuid, text) from public, anon, authenticated;
revoke all on function public.sono_release_pending(uuid) from public, anon, authenticated;
revoke all on function public.sono_confirm_checkout(text, text, text, integer, text, text) from public, anon, authenticated;
revoke all on function public.sono_expire_checkout(text, text) from public, anon, authenticated;
grant execute on function public.sono_claim_slot(uuid, text, text, integer) to service_role;
grant execute on function public.sono_attach_checkout(uuid, text) to service_role;
grant execute on function public.sono_release_pending(uuid) to service_role;
grant execute on function public.sono_confirm_checkout(text, text, text, integer, text, text) to service_role;
grant execute on function public.sono_expire_checkout(text, text) to service_role;
