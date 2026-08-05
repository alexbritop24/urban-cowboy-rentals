-- Sprint 2A.6: production hardening for the Release 1 multi-item request seam.
-- The browser flag is intentionally not authoritative. This database rollout
-- flag defaults to false and must be enabled separately at Release 1 launch.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.release_feature_flags (
  feature_key text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into private.release_feature_flags (feature_key, enabled)
values ('multi_item_rental_requests', false)
on conflict (feature_key) do nothing;

create table if not exists private.rental_equipment_catalog (
  equipment_id text primary key,
  equipment_name text not null,
  status text not null,
  rentable boolean not null default true,
  daily_rate numeric(12, 2) not null,
  serialized boolean not null default false,
  serial_number text,
  updated_at timestamptz not null default now(),
  constraint rental_equipment_catalog_name_check
    check (length(btrim(equipment_name)) > 0),
  constraint rental_equipment_catalog_status_check
    check (status in ('active', 'archived')),
  constraint rental_equipment_catalog_daily_rate_check
    check (daily_rate >= 0),
  constraint rental_equipment_catalog_serial_check
    check (
      (serialized and nullif(btrim(serial_number), '') is not null)
      or (not serialized and serial_number is null)
    )
);

insert into private.rental_equipment_catalog (
  equipment_id,
  equipment_name,
  status,
  rentable,
  daily_rate,
  serialized,
  serial_number
)
values
  ('bobcat-t550-skid-steer', '2024 Bobcat T550 Track Loader', 'active', true, 120, true, 'B57T133070'),
  ('bobcat-e35r2-compact-excavator', '2025 Bobcat E35 Compact Excavator', 'active', true, 275, true, 'B57920400'),
  ('lamar-telescopic-dump-9-ton', '2025 Lamar Telescopic Dump 9 Ton Trailer', 'active', true, 175, false, null),
  ('rawmax-tilt-deck-22', '2025 RawMax Tilt Deck 22’', 'archived', false, 150, false, null),
  ('rawmaxx-dtx-24-tilt-deck', 'RawMaxx DTX 24’ Tilt Deck Trailer', 'active', true, 150, false, null),
  ('utility-trailer', 'Utility Trailer', 'archived', false, 100, false, null),
  ('scissor-lift', 'Electric Scissor Lift', 'active', true, 140, false, null),
  ('hercules-sds-max-demolition-hammer', 'Hercules SDS-MAX Demolition Hammer', 'active', true, 50, false, null),
  ('bauer-65j-demolition-hammer', 'Bauer 65J Demolition Hammer', 'active', true, 50, false, null),
  ('plate-compactor', 'Central Machinery Plate Compactor', 'active', true, 60, false, null),
  ('wacker-rd12-roller', 'Wacker Neuson RD12 Roller', 'active', true, 180, true, 'WNCRD12AEPUM06214'),
  ('kobalt-hand-tamper', 'Kobalt 10×10 Hand Tamper', 'active', true, 10, false, null),
  ('harley-road-glide-2003', '2003 Harley Davidson Road Glide', 'active', true, 180, false, null),
  ('harley-fld-switchback-2012', '2012 Harley Davidson FLD Switchback', 'active', true, 130, false, null)
on conflict (equipment_id) do update
set
  equipment_name = excluded.equipment_name,
  status = excluded.status,
  rentable = excluded.rentable,
  daily_rate = excluded.daily_rate,
  serialized = excluded.serialized,
  serial_number = excluded.serial_number,
  updated_at = now();

revoke all on private.release_feature_flags from public, anon, authenticated;
revoke all on private.rental_equipment_catalog from public, anon, authenticated;

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
    private.current_jwt_claims() ->> 'app_role',
    ''
  ) in ('staff', 'admin');
$$;

create or replace function private.is_feature_enabled(requested_feature text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select coalesce(
    (
      select enabled
      from private.release_feature_flags
      where feature_key = requested_feature
    ),
    false
  );
$$;

create or replace function private.rental_request_item_editability(
  target_rental_request_id uuid
)
returns table (editable boolean, reason text)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  request_status text;
  artifact_exists boolean := false;
begin
  if not private.is_feature_enabled('multi_item_rental_requests') then
    return query select false, 'Multi-item rental requests are not enabled.';
    return;
  end if;

  select status
  into request_status
  from public.rental_requests
  where id = target_rental_request_id;

  if not found then
    return query select false, 'Rental request not found.';
    return;
  end if;

  if request_status <> 'new' then
    return query select false, 'Equipment items are editable only while the request is new.';
    return;
  end if;

  if to_regclass('public.rental_agreements') is not null then
    execute
      'select exists (
         select 1 from public.rental_agreements
         where rental_request_id = $1
       )'
      into artifact_exists
      using target_rental_request_id;
  end if;

  if artifact_exists then
    return query select false, 'Equipment items are locked because an Agreement exists.';
    return;
  end if;

  if to_regclass('public.invoices') is not null then
    execute
      'select exists (
         select 1 from public.invoices
         where rental_request_id = $1
       )'
      into artifact_exists
      using target_rental_request_id;
  end if;

  if artifact_exists then
    return query select false, 'Equipment items are locked because an Invoice exists.';
    return;
  end if;

  return query select true, 'Equipment items may be edited.';
end;
$$;

create or replace function private.validate_rental_request_payload(
  request_payload jsonb
)
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, private
as $$
declare
  unsupported_fields jsonb;
  customer_type_value text;
begin
  if request_payload is null or jsonb_typeof(request_payload) <> 'object' then
    raise exception using errcode = '22023',
      message = 'Rental request payload must be a JSON object.';
  end if;

  if octet_length(request_payload::text) > 32768 then
    raise exception using errcode = '22023',
      message = 'Rental request payload exceeds the 32 KB limit.';
  end if;

  unsupported_fields := request_payload - array[
    'customer_type',
    'business_name',
    'full_name',
    'phone',
    'email',
    'fulfillment_type',
    'project_type',
    'notes',
    'agreement_accepted'
  ]::text[];

  if unsupported_fields <> '{}'::jsonb then
    raise exception using errcode = '22023',
      message = 'Rental request payload contains unsupported fields.';
  end if;

  if jsonb_typeof(request_payload -> 'full_name') is distinct from 'string'
    or jsonb_typeof(request_payload -> 'phone') is distinct from 'string'
    or jsonb_typeof(request_payload -> 'email') is distinct from 'string'
    or jsonb_typeof(request_payload -> 'agreement_accepted') is distinct from 'boolean'
    or (
      request_payload ? 'customer_type'
      and jsonb_typeof(request_payload -> 'customer_type') is distinct from 'string'
    )
    or (
      request_payload ? 'fulfillment_type'
      and jsonb_typeof(request_payload -> 'fulfillment_type') is distinct from 'string'
    )
    or (
      request_payload ? 'business_name'
      and coalesce(jsonb_typeof(request_payload -> 'business_name'), 'null')
        not in ('string', 'null')
    )
    or (
      request_payload ? 'project_type'
      and coalesce(jsonb_typeof(request_payload -> 'project_type'), 'null')
        not in ('string', 'null')
    )
    or (
      request_payload ? 'notes'
      and coalesce(jsonb_typeof(request_payload -> 'notes'), 'null')
        not in ('string', 'null')
    ) then
    raise exception using errcode = '22023',
      message = 'Rental request payload contains malformed field values.';
  end if;

  customer_type_value := coalesce(
    nullif(btrim(request_payload ->> 'customer_type'), ''),
    'individual'
  );

  if customer_type_value not in ('individual', 'business') then
    raise exception using errcode = '22023',
      message = 'Customer type must be individual or business.';
  end if;

  if customer_type_value = 'business'
    and nullif(btrim(request_payload ->> 'business_name'), '') is null then
    raise exception using errcode = '22023',
      message = 'Business name is required for business requests.';
  end if;

  if nullif(btrim(request_payload ->> 'full_name'), '') is null
    or length(request_payload ->> 'full_name') > 200
    or nullif(btrim(request_payload ->> 'phone'), '') is null
    or length(request_payload ->> 'phone') > 40
    or nullif(btrim(request_payload ->> 'email'), '') is null
    or length(request_payload ->> 'email') > 320 then
    raise exception using errcode = '22023',
      message = 'Customer name, phone, or email is missing or too long.';
  end if;

  if (request_payload ->> 'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = '22023',
      message = 'Customer email is invalid.';
  end if;

  if length(coalesce(request_payload ->> 'business_name', '')) > 200
    or length(coalesce(request_payload ->> 'project_type', '')) > 500
    or length(coalesce(request_payload ->> 'notes', '')) > 2000 then
    raise exception using errcode = '22023',
      message = 'Rental request text exceeds its allowed length.';
  end if;

  if coalesce(request_payload ->> 'fulfillment_type', 'Pickup')
    not in ('Pickup', 'Delivery') then
    raise exception using errcode = '22023',
      message = 'Fulfillment type must be Pickup or Delivery.';
  end if;

  begin
    if coalesce((request_payload ->> 'agreement_accepted')::boolean, false)
      is not true then
      raise exception using errcode = '22023',
        message = 'Rental request acknowledgement is required.';
    end if;
  exception
    when invalid_text_representation then
      raise exception using errcode = '22023',
        message = 'Rental request acknowledgement is invalid.';
  end;
end;
$$;

create or replace function private.authoritative_rental_request_items(
  item_payloads jsonb,
  earliest_start timestamptz
)
returns table (
  display_order integer,
  equipment_id text,
  equipment_name text,
  start_date timestamptz,
  end_date timestamptz,
  quantity integer,
  daily_rate numeric,
  serial_number text,
  notes text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, private
as $$
declare
  item_payload jsonb;
  ordinal_position bigint;
  unsupported_fields jsonb;
  requested_equipment_id text;
  item_quantity numeric;
  item_start timestamptz;
  item_end timestamptz;
  catalog_record private.rental_equipment_catalog%rowtype;
begin
  if item_payloads is null
    or jsonb_typeof(item_payloads) <> 'array'
    or jsonb_array_length(item_payloads) = 0 then
    raise exception using errcode = '22023',
      message = 'At least one rental request item is required.';
  end if;

  if jsonb_array_length(item_payloads) > 20 then
    raise exception using errcode = '22023',
      message = 'A rental request cannot contain more than 20 items.';
  end if;

  if octet_length(item_payloads::text) > 65536 then
    raise exception using errcode = '22023',
      message = 'Rental item payload exceeds the 64 KB limit.';
  end if;

  for item_payload, ordinal_position in
    select value, ordinality
    from jsonb_array_elements(item_payloads) with ordinality
  loop
    if jsonb_typeof(item_payload) <> 'object' then
      raise exception using errcode = '22023',
        message = 'Every rental request item must be a JSON object.';
    end if;

    unsupported_fields := item_payload - array[
      'equipment_id',
      'start_date',
      'end_date',
      'quantity',
      'notes'
    ]::text[];

    if unsupported_fields <> '{}'::jsonb then
      raise exception using errcode = '22023',
        message = 'Rental item payload contains manipulated or unsupported fields.';
    end if;

    if jsonb_typeof(item_payload -> 'equipment_id') is distinct from 'string'
      or jsonb_typeof(item_payload -> 'start_date') is distinct from 'string'
      or jsonb_typeof(item_payload -> 'end_date') is distinct from 'string'
      or jsonb_typeof(item_payload -> 'quantity') is distinct from 'number'
      or (
        item_payload ? 'notes'
        and coalesce(jsonb_typeof(item_payload -> 'notes'), 'null')
          not in ('string', 'null')
      ) then
      raise exception using errcode = '22023',
        message = 'Rental item payload contains malformed field values.';
    end if;

    requested_equipment_id := nullif(btrim(item_payload ->> 'equipment_id'), '');

    if requested_equipment_id is null then
      raise exception using errcode = '22023',
        message = 'Every rental request item requires an equipment ID.';
    end if;

    select *
    into catalog_record
    from private.rental_equipment_catalog catalog
    where catalog.equipment_id = requested_equipment_id;

    if not found then
      raise exception using errcode = '22023',
        message = 'Rental request contains an unknown equipment ID.';
    end if;

    if catalog_record.status <> 'active' or not catalog_record.rentable then
      raise exception using errcode = '22023',
        message = 'Requested equipment is not available for new rentals.';
    end if;

    begin
      item_start := nullif(item_payload ->> 'start_date', '')::timestamptz;
      item_end := nullif(item_payload ->> 'end_date', '')::timestamptz;
      item_quantity := nullif(item_payload ->> 'quantity', '')::numeric;
    exception
      when invalid_text_representation or datetime_field_overflow then
        raise exception using errcode = '22023',
          message = 'Rental item dates or quantity are invalid.';
    end;

    if item_start is null or item_end is null or item_end < item_start then
      raise exception using errcode = '22023',
        message = 'Every rental request item requires a valid date range.';
    end if;

    if item_start < earliest_start
      or item_start > now() + interval '2 years'
      or item_end > now() + interval '3 years'
      or item_end - item_start > interval '365 days' then
      raise exception using errcode = '22023',
        message = 'Rental item dates are outside the allowed range.';
    end if;

    if item_quantity is null
      or item_quantity <= 0
      or item_quantity > 100
      or item_quantity <> trunc(item_quantity) then
      raise exception using errcode = '22023',
        message = 'Rental item quantity must be a whole number from 1 to 100.';
    end if;

    if catalog_record.serialized and item_quantity <> 1 then
      raise exception using errcode = '22023',
        message = 'Serialized rental equipment must have quantity 1.';
    end if;

    if length(coalesce(item_payload ->> 'notes', '')) > 2000 then
      raise exception using errcode = '22023',
        message = 'Rental item notes cannot exceed 2,000 characters.';
    end if;

    display_order := ordinal_position - 1;
    equipment_id := catalog_record.equipment_id;
    equipment_name := catalog_record.equipment_name;
    start_date := item_start;
    end_date := item_end;
    quantity := item_quantity::integer;
    daily_rate := catalog_record.daily_rate;
    serial_number := catalog_record.serial_number;
    notes := nullif(btrim(item_payload ->> 'notes'), '');
    return next;
  end loop;
end;
$$;

create or replace function private.authoritative_item_payloads(
  item_payloads jsonb,
  earliest_start timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select jsonb_agg(
    jsonb_build_object(
      'display_order', display_order,
      'equipment_id', equipment_id,
      'equipment_name', equipment_name,
      'start_date', start_date,
      'end_date', end_date,
      'quantity', quantity,
      'daily_rate', daily_rate,
      'serial_number', serial_number,
      'notes', notes
    )
    order by display_order
  )
  from private.authoritative_rental_request_items(item_payloads, earliest_start);
$$;

create or replace function public.get_rental_request_item_editability(
  target_rental_request_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  editability record;
begin
  if not private.is_staff() then
    raise exception using errcode = '42501',
      message = 'Staff authorization is required.';
  end if;

  select * into editability
  from private.rental_request_item_editability(target_rental_request_id);

  return jsonb_build_object(
    'editable', editability.editable,
    'reason', editability.reason
  );
end;
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
  authoritative_items jsonb;
begin
  if not private.is_feature_enabled('multi_item_rental_requests') then
    raise exception using errcode = '55000',
      message = 'Multi-item rental requests are not enabled.';
  end if;

  perform private.validate_rental_request_payload(request_payload);

  authoritative_items := private.authoritative_item_payloads(
    item_payloads,
    now() - interval '1 day'
  );

  select * into summary_record
  from private.rental_request_item_summary(authoritative_items);

  customer_type_value := coalesce(
    nullif(btrim(request_payload ->> 'customer_type'), ''),
    'individual'
  );

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
    (value ->> 'display_order')::integer,
    value ->> 'equipment_id',
    value ->> 'equipment_name',
    (value ->> 'start_date')::timestamptz,
    (value ->> 'end_date')::timestamptz,
    (value ->> 'quantity')::integer,
    (value ->> 'daily_rate')::numeric,
    nullif(value ->> 'serial_number', ''),
    nullif(value ->> 'notes', '')
  from jsonb_array_elements(authoritative_items);

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
  editability record;
  authoritative_items jsonb;
  preserve_legacy_quote boolean;
  previous_quote numeric;
begin
  if not private.is_feature_enabled('multi_item_rental_requests') then
    raise exception using errcode = '55000',
      message = 'Multi-item rental requests are not enabled.';
  end if;

  if not private.is_staff() then
    raise exception using errcode = '42501',
      message = 'Staff authorization is required to replace rental request items.';
  end if;

  if legacy_fields is null or jsonb_typeof(legacy_fields) <> 'object' then
    raise exception using errcode = '22023',
      message = 'Legacy compatibility payload must be a JSON object.';
  end if;

  if legacy_fields <> '{}'::jsonb then
    raise exception using errcode = '22023',
      message = 'Legacy compatibility values are computed by the server.';
  end if;

  select
    quote_amount,
    not exists (
      select 1
      from public.rental_request_items items
      where items.rental_request_id = requests.id
    )
  into previous_quote, preserve_legacy_quote
  from public.rental_requests requests
  where requests.id = target_rental_request_id
  for update;

  if not found then
    raise exception using errcode = 'P0002',
      message = 'Rental request not found.';
  end if;

  select * into editability
  from private.rental_request_item_editability(target_rental_request_id);

  if not editability.editable then
    raise exception using errcode = '55000',
      message = editability.reason;
  end if;

  authoritative_items := private.authoritative_item_payloads(
    item_payloads,
    now() - interval '10 years'
  );

  select * into summary_record
  from private.rental_request_item_summary(authoritative_items);

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
    (value ->> 'display_order')::integer,
    value ->> 'equipment_id',
    value ->> 'equipment_name',
    (value ->> 'start_date')::timestamptz,
    (value ->> 'end_date')::timestamptz,
    (value ->> 'quantity')::integer,
    (value ->> 'daily_rate')::numeric,
    nullif(value ->> 'serial_number', ''),
    nullif(value ->> 'notes', '')
  from jsonb_array_elements(authoritative_items);

  update public.rental_requests
  set
    equipment_requested = summary_record.equipment_requested,
    rental_start_date = summary_record.pickup_date::date,
    rental_end_date = summary_record.return_date::date,
    pickup_date = summary_record.pickup_date,
    return_date = summary_record.return_date,
    rental_duration = summary_record.rental_duration,
    quote_amount = case
      when preserve_legacy_quote then previous_quote
      else summary_record.estimated_subtotal
    end,
    availability_status = 'pending_review',
    availability_notes = 'Item schedule changed; availability requires review.',
    updated_at = now()
  where id = target_rental_request_id;
end;
$$;

drop policy if exists "authenticated staff can read rental request items"
  on public.rental_request_items;
drop policy if exists "authenticated staff can insert rental request items"
  on public.rental_request_items;
drop policy if exists "authenticated staff can update rental request items"
  on public.rental_request_items;
drop policy if exists "authenticated staff can delete rental request items"
  on public.rental_request_items;
drop policy if exists "staff can read rental request items"
  on public.rental_request_items;

create policy "staff can read rental request items"
  on public.rental_request_items
  for select
  to authenticated
  using (private.is_staff());

revoke all on public.rental_request_items from public, anon, authenticated;
grant select on public.rental_request_items to authenticated;

revoke all on function private.current_jwt_claims() from public, anon, authenticated;
revoke all on function private.is_staff() from public, anon, authenticated;
grant execute on function private.is_staff() to authenticated;
revoke all on function private.is_feature_enabled(text) from public, anon, authenticated;
revoke all on function private.rental_request_item_editability(uuid) from public, anon, authenticated;
revoke all on function private.validate_rental_request_payload(jsonb) from public, anon, authenticated;
revoke all on function private.authoritative_rental_request_items(jsonb, timestamptz)
  from public, anon, authenticated;
revoke all on function private.authoritative_item_payloads(jsonb, timestamptz)
  from public, anon, authenticated;

revoke all on function public.get_rental_request_item_editability(uuid)
  from public, anon, authenticated;
grant execute on function public.get_rental_request_item_editability(uuid)
  to authenticated;

revoke all on function public.create_rental_request_with_items(jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_rental_request_with_items(jsonb, jsonb)
  to anon, authenticated;

revoke all on function public.replace_rental_request_items(uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_rental_request_items(uuid, jsonb, jsonb)
  to authenticated;

comment on table private.release_feature_flags is
  'Server-authoritative rollout flags. Multi-item requests remain disabled until an explicit production activation.';
comment on table private.rental_equipment_catalog is
  'Release 1 authoritative rental catalog used by persistence RPCs; never populated from browser metadata.';
comment on function private.is_staff() is
  'Release 1 staff authorization extension point. Tokens require app_metadata.role or app_role equal to staff/admin.';
comment on function public.create_rental_request_with_items(jsonb, jsonb) is
  'Creates a request transactionally from customer data and authoritative server-side catalog values.';
comment on function public.replace_rental_request_items(uuid, jsonb, jsonb) is
  'Staff-only transactional item replacement with lifecycle protection and atomic legacy synchronization.';
