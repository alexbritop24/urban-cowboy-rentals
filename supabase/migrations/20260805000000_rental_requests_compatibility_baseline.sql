create extension if not exists pgcrypto;

-- The production application already owns this table. This compatibility
-- baseline creates it only for clean local databases and leaves an existing
-- production table and its policies intact.
create table if not exists public.rental_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  full_name text not null,
  phone text not null,
  email text not null,
  equipment_requested text not null,
  rental_start_date date,
  rental_end_date date,
  pickup_date timestamptz,
  return_date timestamptz,
  rental_duration text,
  fulfillment_type text,
  project_type text,
  notes text,
  agreement_accepted boolean not null default false,
  status text not null default 'new',
  source text not null default 'website',
  assigned_to text,
  internal_notes text,
  priority text not null default 'normal',
  quote_amount numeric(12, 2),
  deposit_status text not null default 'not_required',
  payment_status text not null default 'unpaid',
  delivery_status text not null default 'not_scheduled',
  availability_status text not null default 'pending_review',
  availability_notes text,
  payment_link text
);

alter table public.rental_requests
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists customer_type text not null default 'individual',
  add column if not exists business_name text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rental_requests'::regclass
      and conname = 'rental_requests_customer_type_check'
  ) then
    alter table public.rental_requests
      add constraint rental_requests_customer_type_check
      check (customer_type in ('individual', 'business')) not valid;
  end if;
end;
$$;

grant usage on schema public to anon, authenticated;
grant insert on public.rental_requests to anon;
grant select, insert, update, delete on public.rental_requests to authenticated;
