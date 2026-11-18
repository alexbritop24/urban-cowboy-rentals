create or replace function public.create_staff_rental_request(request_id uuid, details jsonb)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  start_time timestamptz;
  end_time timestamptz;
  customer_kind text := details->>'customer_type';
  contact_name text := btrim(details->>'full_name');
  company_name text := nullif(btrim(details->>'business_name'), '');
  contact_phone text := regexp_replace(details->>'phone', '[^0-9]', '', 'g');
  contact_email text := btrim(details->>'email');
  selected_equipment_name text := details->>'equipment_requested';
  request_source text := details->>'source';
  existing_source text;
  duration_hours integer;
begin
  if not private.is_staff() then
    raise exception using errcode = '42501', message = 'Staff access is required.';
  end if;
  if request_id is null then
    raise exception using errcode = '22023', message = 'A request identifier is required.';
  end if;

  -- A retry after a lost response must reopen the original request.
  perform pg_advisory_xact_lock(hashtextextended(request_id::text, 0));
  select source into existing_source from public.rental_requests where id = request_id;
  if found then
    if existing_source in ('phone', 'walk_in') then return request_id; end if;
    raise exception using errcode = '22023', message = 'Request identifier is already in use.';
  end if;

  if jsonb_typeof(details) is distinct from 'object'
    or customer_kind is null or customer_kind not in ('individual', 'business')
    or contact_name is null or length(contact_name) not between 1 and 200
    or contact_phone is null or length(contact_phone) not between 7 and 15
    or contact_email is null or length(contact_email) > 254
    or contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or request_source is null or request_source not in ('phone', 'walk_in')
    or details->>'fulfillment_type' is null or details->>'fulfillment_type' not in ('Pickup', 'Delivery')
    or (customer_kind = 'business' and (company_name is null or length(company_name) > 200))
    or length(coalesce(details->>'notes', '')) > 10000
    or length(coalesce(details->>'project_type', '')) > 2000 then
    raise exception using errcode = '22023', message = 'Valid customer and rental details are required.';
  end if;
  if not exists (
    select 1 from private.rental_equipment_catalog catalog
    where catalog.equipment_name = selected_equipment_name
      and catalog.status = 'active' and catalog.rentable
  ) then
    raise exception using errcode = '22023', message = 'Select available catalog equipment.';
  end if;
  start_time := (details->>'pickup_date')::timestamptz;
  end_time := (details->>'return_date')::timestamptz;
  if start_time is null or end_time is null or end_time <= start_time
    or not isfinite(start_time) or not isfinite(end_time) then
    raise exception using errcode = '22023', message = 'Valid rental start and return times are required.';
  end if;
  duration_hours := ceil(extract(epoch from (end_time - start_time)) / 3600);

  insert into public.rental_requests (
    id, customer_type, business_name, full_name, phone, email,
    equipment_requested, rental_start_date, rental_end_date, pickup_date, return_date,
    rental_duration, fulfillment_type, project_type, notes, agreement_accepted,
    source, status, priority, payment_status, deposit_status, delivery_status, availability_status
  ) values (
    request_id, customer_kind, case when customer_kind = 'business' then company_name end,
    contact_name, contact_phone, contact_email, selected_equipment_name,
    (start_time at time zone 'America/Denver')::date,
    (end_time at time zone 'America/Denver')::date, start_time, end_time,
    duration_hours::text || case when duration_hours = 1 then ' hour' else ' hours' end,
    details->>'fulfillment_type', details->>'project_type', details->>'notes', false,
    request_source, 'new', 'normal', 'unpaid', 'not_required', 'not_scheduled', 'pending_review'
  );
  return request_id;
end;
$$;

revoke all on function public.create_staff_rental_request(uuid, jsonb) from public, anon;
grant execute on function public.create_staff_rental_request(uuid, jsonb) to authenticated;
