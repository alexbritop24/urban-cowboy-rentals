create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.rental_request_items (
  id uuid primary key default gen_random_uuid(),
  rental_request_id uuid not null,
  display_order integer not null,
  equipment_id text,
  equipment_name text not null,
  start_date timestamptz not null,
  end_date timestamptz not null,
  quantity integer not null default 1,
  daily_rate numeric(12, 2) not null default 0,
  serial_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rental_request_items_rental_request_fk
    foreign key (rental_request_id)
    references public.rental_requests(id)
    on update restrict
    on delete cascade,
  constraint rental_request_items_display_order_check
    check (display_order >= 0),
  constraint rental_request_items_equipment_name_check
    check (length(btrim(equipment_name)) > 0),
  constraint rental_request_items_date_range_check
    check (end_date >= start_date),
  constraint rental_request_items_quantity_check
    check (quantity > 0),
  constraint rental_request_items_daily_rate_check
    check (daily_rate >= 0),
  constraint rental_request_items_serial_quantity_check
    check (serial_number is null or quantity = 1),
  constraint rental_request_items_request_order_key
    unique (rental_request_id, display_order)
);

create index if not exists rental_request_items_request_id_idx
  on public.rental_request_items (rental_request_id);

create index if not exists rental_request_items_equipment_schedule_idx
  on public.rental_request_items (equipment_id, start_date, end_date)
  where equipment_id is not null;

create index if not exists rental_request_items_schedule_idx
  on public.rental_request_items (start_date, end_date);

alter table public.rental_request_items enable row level security;

create or replace function private.set_current_timestamp_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists rental_request_items_set_updated_at
  on public.rental_request_items;
create trigger rental_request_items_set_updated_at
before update on public.rental_request_items
for each row
execute function private.set_current_timestamp_updated_at();

drop policy if exists "authenticated staff can read rental request items"
  on public.rental_request_items;
create policy "authenticated staff can read rental request items"
  on public.rental_request_items
  for select
  to authenticated
  using (true);

drop policy if exists "authenticated staff can insert rental request items"
  on public.rental_request_items;
create policy "authenticated staff can insert rental request items"
  on public.rental_request_items
  for insert
  to authenticated
  with check (true);

drop policy if exists "authenticated staff can update rental request items"
  on public.rental_request_items;
create policy "authenticated staff can update rental request items"
  on public.rental_request_items
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated staff can delete rental request items"
  on public.rental_request_items;
create policy "authenticated staff can delete rental request items"
  on public.rental_request_items
  for delete
  to authenticated
  using (true);

revoke all on public.rental_request_items from public, anon, authenticated;
grant select, insert, update, delete on public.rental_request_items to authenticated;

create or replace function private.validate_rental_request_item_payloads(
  item_payloads jsonb
)
returns void
language plpgsql
stable
set search_path = pg_catalog, public, private
as $$
declare
  item_payload jsonb;
  item_quantity numeric;
  item_daily_rate numeric;
  item_start timestamptz;
  item_end timestamptz;
begin
  if item_payloads is null
    or jsonb_typeof(item_payloads) <> 'array'
    or jsonb_array_length(item_payloads) = 0 then
    raise exception using
      errcode = '22023',
      message = 'At least one rental request item is required.';
  end if;

  for item_payload in
    select value from jsonb_array_elements(item_payloads)
  loop
    if jsonb_typeof(item_payload) <> 'object' then
      raise exception using
        errcode = '22023',
        message = 'Every rental request item must be a JSON object.';
    end if;

    if nullif(btrim(item_payload ->> 'equipment_name'), '') is null then
      raise exception using
        errcode = '22023',
        message = 'Every rental request item requires an equipment name.';
    end if;

    begin
      item_start := nullif(item_payload ->> 'start_date', '')::timestamptz;
      item_end := nullif(item_payload ->> 'end_date', '')::timestamptz;
      item_quantity := nullif(item_payload ->> 'quantity', '')::numeric;
      item_daily_rate := nullif(item_payload ->> 'daily_rate', '')::numeric;
    exception
      when invalid_text_representation or datetime_field_overflow then
        raise exception using
          errcode = '22023',
          message = 'Rental request item dates, quantity, or daily rate are invalid.';
    end;

    if item_start is null or item_end is null or item_end < item_start then
      raise exception using
        errcode = '22023',
        message = 'Every rental request item requires a valid date range.';
    end if;

    if item_quantity is null
      or item_quantity <= 0
      or item_quantity <> trunc(item_quantity) then
      raise exception using
        errcode = '22023',
        message = 'Every rental request item requires a positive whole quantity.';
    end if;

    if item_daily_rate is null or item_daily_rate < 0 then
      raise exception using
        errcode = '22023',
        message = 'Every rental request item requires a nonnegative daily rate.';
    end if;

    if nullif(btrim(item_payload ->> 'serial_number'), '') is not null
      and item_quantity <> 1 then
      raise exception using
        errcode = '22023',
        message = 'Serialized rental request items must have quantity 1.';
    end if;
  end loop;
end;
$$;

create or replace function private.rental_request_item_summary(
  item_payloads jsonb
)
returns table (
  equipment_requested text,
  pickup_date timestamptz,
  return_date timestamptz,
  rental_duration text,
  estimated_subtotal numeric
)
language sql
stable
set search_path = pg_catalog, public, private
as $$
  with items as (
    select
      ordinal_position,
      btrim(value ->> 'equipment_name') as equipment_name,
      (value ->> 'start_date')::timestamptz as start_date,
      (value ->> 'end_date')::timestamptz as end_date,
      (value ->> 'quantity')::integer as quantity,
      (value ->> 'daily_rate')::numeric as daily_rate
    from jsonb_array_elements(item_payloads) with ordinality
      as payload(value, ordinal_position)
  ),
  aggregate_values as (
    select
      string_agg(equipment_name, ', ' order by ordinal_position) as equipment_requested,
      min(start_date) as pickup_date,
      max(end_date) as return_date,
      count(*) as item_count,
      sum(
        daily_rate
        * quantity
        * greatest(1, ceil(extract(epoch from (end_date - start_date)) / 86400))
      )::numeric(12, 2) as estimated_subtotal
    from items
  )
  select
    equipment_requested,
    pickup_date,
    return_date,
    case
      when item_count = 1 then
        greatest(1, ceil(extract(epoch from (return_date - pickup_date)) / 86400))::integer::text
          || ' day'
          || case
            when greatest(1, ceil(extract(epoch from (return_date - pickup_date)) / 86400)) = 1
              then ''
            else 's'
          end
      else item_count::text || ' independently scheduled items'
    end as rental_duration,
    estimated_subtotal
  from aggregate_values;
$$;

create or replace function public.create_rental_request_with_items(
  request_payload jsonb,
  item_payloads jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  new_request_id uuid;
  summary_record record;
  customer_type_value text;
begin
  if request_payload is null or jsonb_typeof(request_payload) <> 'object' then
    raise exception using
      errcode = '22023',
      message = 'Rental request payload must be a JSON object.';
  end if;

  customer_type_value := coalesce(
    nullif(btrim(request_payload ->> 'customer_type'), ''),
    'individual'
  );

  if customer_type_value not in ('individual', 'business') then
    raise exception using
      errcode = '22023',
      message = 'Customer type must be individual or business.';
  end if;

  if customer_type_value = 'business'
    and nullif(btrim(request_payload ->> 'business_name'), '') is null then
    raise exception using
      errcode = '22023',
      message = 'Business name is required for business requests.';
  end if;

  if nullif(btrim(request_payload ->> 'full_name'), '') is null
    or nullif(btrim(request_payload ->> 'phone'), '') is null
    or nullif(btrim(request_payload ->> 'email'), '') is null then
    raise exception using
      errcode = '22023',
      message = 'Customer name, phone, and email are required.';
  end if;

  if coalesce((request_payload ->> 'agreement_accepted')::boolean, false) is not true then
    raise exception using
      errcode = '22023',
      message = 'Rental request acknowledgement is required.';
  end if;

  perform private.validate_rental_request_item_payloads(item_payloads);

  select * into summary_record
  from private.rental_request_item_summary(item_payloads);

  insert into public.rental_requests (
    customer_type,
    business_name,
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
  ) values (
    customer_type_value,
    case when customer_type_value = 'business'
      then nullif(btrim(request_payload ->> 'business_name'), '')
      else null
    end,
    btrim(request_payload ->> 'full_name'),
    btrim(request_payload ->> 'phone'),
    btrim(request_payload ->> 'email'),
    summary_record.equipment_requested,
    summary_record.pickup_date::date,
    summary_record.return_date::date,
    summary_record.pickup_date,
    summary_record.return_date,
    summary_record.rental_duration,
    coalesce(nullif(request_payload ->> 'fulfillment_type', ''), 'Pickup'),
    nullif(btrim(request_payload ->> 'project_type'), ''),
    nullif(btrim(request_payload ->> 'notes'), ''),
    true,
    'new',
    'website',
    'normal',
    'unpaid',
    'not_required',
    'not_scheduled',
    'pending_review',
    null
  )
  returning id into new_request_id;

  insert into public.rental_request_items (
    rental_request_id,
    display_order,
    equipment_id,
    equipment_name,
    start_date,
    end_date,
    quantity,
    daily_rate,
    serial_number,
    notes
  )
  select
    new_request_id,
    ordinal_position - 1,
    nullif(btrim(value ->> 'equipment_id'), ''),
    btrim(value ->> 'equipment_name'),
    (value ->> 'start_date')::timestamptz,
    (value ->> 'end_date')::timestamptz,
    (value ->> 'quantity')::integer,
    (value ->> 'daily_rate')::numeric,
    nullif(btrim(value ->> 'serial_number'), ''),
    nullif(btrim(value ->> 'notes'), '')
  from jsonb_array_elements(item_payloads) with ordinality
    as payload(value, ordinal_position);

  return new_request_id;
end;
$$;

create or replace function public.replace_rental_request_items(
  target_rental_request_id uuid,
  item_payloads jsonb,
  legacy_fields jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  summary_record record;
  requested_quote numeric;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'authenticated' then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required to replace rental request items.';
  end if;

  if legacy_fields is null or jsonb_typeof(legacy_fields) <> 'object' then
    raise exception using
      errcode = '22023',
      message = 'Legacy summary fields must be a JSON object.';
  end if;

  perform 1
  from public.rental_requests
  where id = target_rental_request_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Rental request not found.';
  end if;

  perform private.validate_rental_request_item_payloads(item_payloads);

  begin
    requested_quote := nullif(legacy_fields ->> 'quote_amount', '')::numeric;
  exception
    when invalid_text_representation then
      raise exception using
        errcode = '22023',
        message = 'Quote amount must be numeric.';
  end;

  if requested_quote is not null and requested_quote < 0 then
    raise exception using
      errcode = '22023',
      message = 'Quote amount cannot be negative.';
  end if;

  select * into summary_record
  from private.rental_request_item_summary(item_payloads);

  delete from public.rental_request_items
  where rental_request_id = target_rental_request_id;

  insert into public.rental_request_items (
    rental_request_id,
    display_order,
    equipment_id,
    equipment_name,
    start_date,
    end_date,
    quantity,
    daily_rate,
    serial_number,
    notes
  )
  select
    target_rental_request_id,
    ordinal_position - 1,
    nullif(btrim(value ->> 'equipment_id'), ''),
    btrim(value ->> 'equipment_name'),
    (value ->> 'start_date')::timestamptz,
    (value ->> 'end_date')::timestamptz,
    (value ->> 'quantity')::integer,
    (value ->> 'daily_rate')::numeric,
    nullif(btrim(value ->> 'serial_number'), ''),
    nullif(btrim(value ->> 'notes'), '')
  from jsonb_array_elements(item_payloads) with ordinality
    as payload(value, ordinal_position);

  update public.rental_requests
  set
    equipment_requested = summary_record.equipment_requested,
    rental_start_date = summary_record.pickup_date::date,
    rental_end_date = summary_record.return_date::date,
    pickup_date = summary_record.pickup_date,
    return_date = summary_record.return_date,
    rental_duration = summary_record.rental_duration,
    quote_amount = coalesce(requested_quote, summary_record.estimated_subtotal),
    availability_status = 'pending_review',
    availability_notes = 'Item schedule changed; availability requires review.',
    updated_at = now()
  where id = target_rental_request_id;
end;
$$;

revoke all on function private.validate_rental_request_item_payloads(jsonb)
  from public, anon, authenticated;
revoke all on function private.rental_request_item_summary(jsonb)
  from public, anon, authenticated;
revoke all on function private.set_current_timestamp_updated_at()
  from public, anon, authenticated;

revoke all on function public.create_rental_request_with_items(jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_rental_request_with_items(jsonb, jsonb)
  to anon, authenticated;

revoke all on function public.replace_rental_request_items(uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_rental_request_items(uuid, jsonb, jsonb)
  to authenticated;

comment on function public.create_rental_request_with_items(jsonb, jsonb) is
  'Atomically creates one rental request and its normalized request items.';
comment on function public.replace_rental_request_items(uuid, jsonb, jsonb) is
  'Atomically replaces draft request items, updates legacy summaries, and invalidates availability.';
