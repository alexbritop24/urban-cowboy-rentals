create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.current_jwt_claims()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select coalesce(
    private.current_jwt_claims() #>> '{app_metadata,role}',
    private.current_jwt_claims() #>> '{app_metadata,app_role}',
    ''
  ) in ('staff', 'admin');
$$;

-- The production application already owns this table. This compatibility
-- baseline creates it only for clean local databases, adds Release 1 columns,
-- and replaces prior request policies with the effective least-privilege set.
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

alter table public.rental_requests enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'rental_requests'
  loop
    execute format(
      'drop policy %I on public.rental_requests',
      existing_policy.policyname
    );
  end loop;
end;
$$;

create policy "anonymous can submit legacy rental requests"
  on public.rental_requests
  for insert
  to anon
  with check (
    agreement_accepted is true
    and status = 'new'
    and source = 'website'
    and priority = 'normal'
    and payment_status = 'unpaid'
    and deposit_status = 'not_required'
    and delivery_status = 'not_scheduled'
    and availability_status = 'pending_review'
    and assigned_to is null
    and internal_notes is null
    and quote_amount is null
    and payment_link is null
  );

create policy "staff can read rental requests"
  on public.rental_requests
  for select
  to authenticated
  using (private.is_staff());

create policy "staff can update rental requests"
  on public.rental_requests
  for update
  to authenticated
  using (private.is_staff())
  with check (private.is_staff());

revoke all on public.rental_requests from public, anon, authenticated;
grant insert (
  full_name,
  phone,
  email,
  equipment_requested,
  rental_start_date,
  rental_end_date,
  pickup_date,
  return_date,
  rental_duration,
  fulfillment_type,
  project_type,
  notes,
  agreement_accepted,
  status,
  source,
  priority,
  payment_status,
  deposit_status,
  delivery_status,
  availability_status,
  availability_notes
) on public.rental_requests to anon;
grant select, update on public.rental_requests to authenticated;

create or replace function private.prevent_protected_rental_request_delete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  artifact_exists boolean := false;
begin
  if old.status <> 'new' then
    raise exception using errcode = '55000',
      message = 'Only new rental requests without downstream records may be deleted.';
  end if;

  if to_regclass('public.rental_agreements') is not null then
    execute
      'select exists (
         select 1 from public.rental_agreements
         where rental_request_id = $1
       )'
      into artifact_exists
      using old.id;
  end if;

  if not artifact_exists and to_regclass('public.invoices') is not null then
    execute
      'select exists (
         select 1 from public.invoices
         where rental_request_id = $1
       )'
      into artifact_exists
      using old.id;
  end if;

  if artifact_exists then
    raise exception using errcode = '55000',
      message = 'Rental requests with Agreements or Invoices cannot be deleted.';
  end if;

  return old;
end;
$$;

drop trigger if exists rental_requests_prevent_protected_delete
  on public.rental_requests;
create trigger rental_requests_prevent_protected_delete
before delete on public.rental_requests
for each row
execute function private.prevent_protected_rental_request_delete();

create or replace function public.has_rental_request_conflict(
  requested_equipment_name text,
  requested_pickup timestamptz,
  requested_return timestamptz
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if nullif(btrim(requested_equipment_name), '') is null
    or length(requested_equipment_name) > 300
    or requested_pickup is null
    or requested_return is null
    or requested_return <= requested_pickup then
    raise exception using errcode = '22023',
      message = 'A valid equipment name and date range are required.';
  end if;

  return exists (
    select 1
    from public.rental_requests
    where equipment_requested = requested_equipment_name
      and status <> 'cancelled'
      and pickup_date is not null
      and return_date is not null
      and requested_pickup < return_date
      and requested_return > pickup_date
  );
end;
$$;

revoke all on function private.current_jwt_claims() from public, anon, authenticated;
revoke all on function private.is_staff() from public, anon, authenticated;
grant execute on function private.is_staff() to authenticated;
revoke all on function private.prevent_protected_rental_request_delete()
  from public, anon, authenticated;
revoke all on function public.has_rental_request_conflict(text, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.has_rental_request_conflict(text, timestamptz, timestamptz)
  to anon, authenticated;
