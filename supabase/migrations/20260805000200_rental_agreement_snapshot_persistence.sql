create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

do $$
declare
  pgcrypto_schema text;
begin
  select namespaces.nspname into pgcrypto_schema
  from pg_catalog.pg_extension installed_extensions
  join pg_catalog.pg_namespace namespaces
    on namespaces.oid = installed_extensions.extnamespace
  where installed_extensions.extname = 'pgcrypto';

  if pgcrypto_schema is distinct from 'extensions' then
    raise exception using errcode = '55000',
      message = 'pgcrypto must be installed in the extensions schema before applying Agreement migrations.';
  end if;
end;
$$;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.rental_requests
  add column if not exists billing_address text,
  add column if not exists service_address text,
  add column if not exists insurance_verification_status text not null default 'pending';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.rental_requests'::regclass
      and conname = 'rental_requests_insurance_verification_status_check'
  ) then
    alter table public.rental_requests
      add constraint rental_requests_insurance_verification_status_check
      check (insurance_verification_status in ('pending', 'verified', 'rejected'))
      not valid;
  end if;
end;
$$;

create table if not exists public.agreement_clauses (
  id uuid primary key default gen_random_uuid(),
  clause_key text,
  title text not null,
  body text not null,
  display_order integer not null default 0,
  enabled boolean not null default true,
  category text not null default 'general',
  equipment_category text,
  state_code text not null default 'UT',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agreement_clauses
  add column if not exists clause_key text,
  add column if not exists display_order integer not null default 0,
  add column if not exists enabled boolean not null default true,
  add column if not exists category text not null default 'general',
  add column if not exists equipment_category text,
  add column if not exists state_code text not null default 'UT',
  add column if not exists version integer not null default 1,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.rental_agreements (
  id uuid primary key default gen_random_uuid(),
  rental_request_id uuid not null,
  agreement_number text not null,
  status text not null default 'draft',
  customer_type text not null default 'individual',
  customer_name text not null,
  business_name text,
  customer_email text not null,
  customer_phone text not null,
  billing_address text,
  service_address text,
  equipment_requested text not null,
  rental_start_date date,
  rental_end_date date,
  rental_duration text,
  fulfillment_type text,
  quote_amount numeric(12, 2) not null default 0,
  deposit_amount numeric(12, 2) not null default 0,
  delivery_fee numeric(12, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  agreement_html text,
  signed_pdf_url text,
  effective_at timestamptz not null default now(),
  signature_status text not null default 'pending',
  acceptance_acknowledged boolean not null default false,
  authorized_signer_name text,
  authorized_signer_title text,
  accepted_terms_version text,
  credit_card_authorization_acknowledged boolean not null default false,
  credit_card_authorization_acknowledged_at timestamptz,
  insurance_verification_status text not null default 'pending',
  availability_confirmation_status text not null default 'pending_review',
  terms_version text,
  clause_snapshot jsonb not null default '[]'::jsonb,
  clause_snapshot_created_at timestamptz,
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  signed_by uuid,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rental_agreements
  add column if not exists customer_type text not null default 'individual',
  add column if not exists business_name text,
  add column if not exists billing_address text,
  add column if not exists service_address text,
  add column if not exists effective_at timestamptz not null default now(),
  add column if not exists signature_status text not null default 'pending',
  add column if not exists acceptance_acknowledged boolean not null default false,
  add column if not exists authorized_signer_name text,
  add column if not exists authorized_signer_title text,
  add column if not exists accepted_terms_version text,
  add column if not exists credit_card_authorization_acknowledged boolean not null default false,
  add column if not exists credit_card_authorization_acknowledged_at timestamptz,
  add column if not exists insurance_verification_status text not null default 'pending',
  add column if not exists availability_confirmation_status text not null default 'pending_review',
  add column if not exists terms_version text,
  add column if not exists clause_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists clause_snapshot_created_at timestamptz,
  add column if not exists locked_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists signed_by uuid;

-- Existing Agreements predate effective_at. Preserve their original creation
-- time on the first application, before the immutable-snapshot trigger exists.
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.rental_agreements'::regclass
      and tgname = 'rental_agreements_protect_snapshot'
      and not tgisinternal
  ) then
    update public.rental_agreements
    set effective_at = created_at
    where created_at is not null
      and effective_at > created_at;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.rental_agreements'::regclass
      and conname = 'rental_agreements_rental_request_fk'
  ) then
    alter table public.rental_agreements
      add constraint rental_agreements_rental_request_fk
      foreign key (rental_request_id)
      references public.rental_requests(id)
      on update restrict
      on delete restrict;
  end if;

  if exists (
    select rental_request_id
    from public.rental_agreements
    where status in ('sent', 'viewed', 'ready', 'signed')
    group by rental_request_id
    having count(*) > 1
  ) then
    raise exception using errcode = '23505',
      message = 'Cannot enforce one canonical active Agreement per request while multiple non-draft Agreements exist.';
  end if;

  if exists (
    select agreement_number
    from public.rental_agreements
    where agreement_number is not null
    group by agreement_number
    having count(*) > 1
  ) then
    raise exception using errcode = '23505',
      message = 'Cannot enforce unique Agreement numbers until duplicate rental_agreements rows are resolved.';
  end if;
end;
$$;

-- Historical production data can contain retained duplicate drafts. Only active
-- non-draft lifecycle states are canonical; cancelled Agreements are historical.
create unique index if not exists rental_agreements_canonical_request_key
  on public.rental_agreements (rental_request_id)
  where status in ('sent', 'viewed', 'ready', 'signed');
create unique index if not exists rental_agreements_agreement_number_key
  on public.rental_agreements (agreement_number);
create index if not exists rental_agreements_status_idx
  on public.rental_agreements (status);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.rental_agreements'::regclass
      and conname = 'rental_agreements_status_check'
  ) then
    alter table public.rental_agreements
      add constraint rental_agreements_status_check
      check (status in ('draft', 'sent', 'viewed', 'ready', 'signed', 'cancelled'))
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.rental_agreements'::regclass
      and conname = 'rental_agreements_customer_type_check'
  ) then
    alter table public.rental_agreements
      add constraint rental_agreements_customer_type_check
      check (customer_type in ('individual', 'business')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.rental_agreements'::regclass
      and conname = 'rental_agreements_signature_status_check'
  ) then
    alter table public.rental_agreements
      add constraint rental_agreements_signature_status_check
      check (signature_status in ('pending', 'accepted', 'signed')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.rental_agreements'::regclass
      and conname = 'rental_agreements_verification_status_check'
  ) then
    alter table public.rental_agreements
      add constraint rental_agreements_verification_status_check
      check (insurance_verification_status in ('pending', 'verified', 'rejected'))
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.rental_agreements'::regclass
      and conname = 'rental_agreements_availability_status_check'
  ) then
    alter table public.rental_agreements
      add constraint rental_agreements_availability_status_check
      check (availability_confirmation_status in (
        'pending_review', 'available', 'approved', 'conflict', 'unavailable'
      )) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.rental_agreements'::regclass
      and conname = 'rental_agreements_amounts_check'
  ) then
    alter table public.rental_agreements
      add constraint rental_agreements_amounts_check
      check (
        quote_amount >= 0 and deposit_amount >= 0 and delivery_fee >= 0
        and tax_amount >= 0 and total_amount >= 0
      ) not valid;
  end if;
end;
$$;

create table if not exists public.agreement_items (
  id uuid primary key default gen_random_uuid(),
  rental_agreement_id uuid not null,
  rental_request_item_id uuid,
  display_order integer not null,
  equipment_id text,
  equipment_name text not null,
  serial_number text,
  start_date timestamptz not null,
  end_date timestamptz not null,
  quantity integer not null,
  daily_rate numeric(12, 2) not null,
  billable_days integer not null,
  line_total numeric(12, 2) not null,
  notes text,
  created_at timestamptz not null default now(),
  constraint agreement_items_agreement_fk
    foreign key (rental_agreement_id)
    references public.rental_agreements(id)
    on update restrict
    on delete restrict,
  constraint agreement_items_request_item_fk
    foreign key (rental_request_item_id)
    references public.rental_request_items(id)
    on update restrict
    on delete restrict,
  constraint agreement_items_display_order_check check (display_order >= 0),
  constraint agreement_items_equipment_name_check
    check (length(btrim(equipment_name)) > 0),
  constraint agreement_items_date_range_check check (end_date >= start_date),
  constraint agreement_items_quantity_check check (quantity > 0),
  constraint agreement_items_daily_rate_check check (daily_rate >= 0),
  constraint agreement_items_billable_days_check check (billable_days > 0),
  constraint agreement_items_line_total_check check (line_total >= 0),
  constraint agreement_items_serial_quantity_check
    check (serial_number is null or quantity = 1),
  constraint agreement_items_agreement_order_key
    unique (rental_agreement_id, display_order)
);

create index if not exists agreement_items_agreement_id_idx
  on public.agreement_items (rental_agreement_id);
create index if not exists agreement_items_request_item_id_idx
  on public.agreement_items (rental_request_item_id)
  where rental_request_item_id is not null;
create index if not exists agreement_items_equipment_schedule_idx
  on public.agreement_items (equipment_id, start_date, end_date)
  where equipment_id is not null;

create sequence if not exists public.rental_agreement_number_seq;
revoke all on sequence public.rental_agreement_number_seq
  from public, anon, authenticated;

do $$
declare
  maximum_existing_suffix bigint;
  sequence_last_value bigint;
  sequence_is_called boolean;
  highest_allocated_value bigint;
begin
  select max((regexp_match(
    agreement_number,
    '^UCR-[0-9]{4}-([0-9]{6})$'
  ))[1]::bigint)
  into maximum_existing_suffix
  from public.rental_agreements
  where agreement_number ~ '^UCR-[0-9]{4}-[0-9]{6}$';

  select last_value, is_called
  into sequence_last_value, sequence_is_called
  from public.rental_agreement_number_seq;

  highest_allocated_value := case
    when sequence_is_called then sequence_last_value
    else sequence_last_value - 1
  end;

  if coalesce(maximum_existing_suffix, 0) > highest_allocated_value then
    perform pg_catalog.setval(
      'public.rental_agreement_number_seq'::pg_catalog.regclass,
      maximum_existing_suffix,
      true
    );
  end if;
end;
$$;

create or replace function private.current_staff_actor_id()
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, private
as $$
declare
  actor_claim text;
begin
  actor_claim := private.current_jwt_claims() ->> 'sub';
  if actor_claim is null
    or actor_claim !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;
  return actor_claim::uuid;
end;
$$;

create or replace function private.next_rental_agreement_number()
returns text
language sql
volatile
security definer
set search_path = pg_catalog, public
as $$
  select 'UCR-' || to_char(current_date, 'YYYY') || '-'
    || lpad(nextval('public.rental_agreement_number_seq')::text, 6, '0');
$$;

create or replace function private.current_agreement_clause_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'title', title,
        'body', body,
        'display_order', display_order,
        'enabled', enabled,
        'category', category,
        'equipment_category', equipment_category,
        'state_code', state_code,
        'version', version,
        'created_at', created_at,
        'updated_at', updated_at
      ) order by display_order, id
    ),
    '[]'::jsonb
  )
  from public.agreement_clauses
  where enabled is true;
$$;

create or replace function private.prevent_agreement_item_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  raise exception using errcode = '55000',
    message = 'Agreement item snapshots are immutable.';
end;
$$;

drop trigger if exists agreement_items_prevent_update
  on public.agreement_items;
create trigger agreement_items_prevent_update
before update on public.agreement_items
for each row execute function private.prevent_agreement_item_mutation();

drop trigger if exists agreement_items_prevent_delete
  on public.agreement_items;
create trigger agreement_items_prevent_delete
before delete on public.agreement_items
for each row execute function private.prevent_agreement_item_mutation();

create or replace function private.protect_rental_agreement_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  legacy_snapshot_hydration boolean;
begin
  legacy_snapshot_hydration :=
    old.locked_at is null
    and nullif(old.terms_version, '') is null
    and coalesce(jsonb_array_length(new.clause_snapshot), 0) > 0
    and nullif(new.terms_version, '') is not null
    and (
      coalesce(jsonb_array_length(old.clause_snapshot), 0) = 0
      or old.clause_snapshot is not distinct from new.clause_snapshot
    );

  if old.rental_request_id is distinct from new.rental_request_id
    or old.agreement_number is distinct from new.agreement_number
    or old.customer_type is distinct from new.customer_type
    or old.customer_name is distinct from new.customer_name
    or old.business_name is distinct from new.business_name
    or old.customer_email is distinct from new.customer_email
    or old.customer_phone is distinct from new.customer_phone
    or old.billing_address is distinct from new.billing_address
    or old.service_address is distinct from new.service_address
    or old.equipment_requested is distinct from new.equipment_requested
    or old.rental_start_date is distinct from new.rental_start_date
    or old.rental_end_date is distinct from new.rental_end_date
    or old.rental_duration is distinct from new.rental_duration
    or old.fulfillment_type is distinct from new.fulfillment_type
    or old.quote_amount is distinct from new.quote_amount
    or old.effective_at is distinct from new.effective_at
    or (
      (
        old.insurance_verification_status is distinct from new.insurance_verification_status
        or old.availability_confirmation_status is distinct from new.availability_confirmation_status
        or old.terms_version is distinct from new.terms_version
        or old.clause_snapshot is distinct from new.clause_snapshot
        or old.clause_snapshot_created_at is distinct from new.clause_snapshot_created_at
      )
      and not legacy_snapshot_hydration
    ) then
    raise exception using errcode = '55000',
      message = 'Agreement legal and item-summary snapshots are immutable.';
  end if;

  if old.locked_at is not null then
    raise exception using errcode = '55000',
      message = 'Finalized Agreements are immutable.';
  end if;

  return new;
end;
$$;

drop trigger if exists rental_agreements_protect_snapshot
  on public.rental_agreements;
create trigger rental_agreements_protect_snapshot
before update on public.rental_agreements
for each row execute function private.protect_rental_agreement_snapshot();

drop trigger if exists rental_agreements_set_updated_at
  on public.rental_agreements;
create trigger rental_agreements_set_updated_at
before update on public.rental_agreements
for each row execute function private.set_current_timestamp_updated_at();

drop trigger if exists agreement_clauses_set_updated_at
  on public.agreement_clauses;
create trigger agreement_clauses_set_updated_at
before update on public.agreement_clauses
for each row execute function private.set_current_timestamp_updated_at();

alter table public.rental_agreements enable row level security;
alter table public.agreement_items enable row level security;
alter table public.agreement_clauses enable row level security;

do $$
declare
  existing_policy record;
  target_table text;
begin
  foreach target_table in array array[
    'rental_agreements', 'agreement_items', 'agreement_clauses'
  ]
  loop
    for existing_policy in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = target_table
    loop
      execute format(
        'drop policy %I on public.%I',
        existing_policy.policyname,
        target_table
      );
    end loop;
  end loop;
end;
$$;

create policy "staff can read rental agreements"
  on public.rental_agreements
  for select to authenticated
  using (private.is_staff());

create policy "staff can read agreement items"
  on public.agreement_items
  for select to authenticated
  using (private.is_staff());

create policy "staff can read agreement clauses"
  on public.agreement_clauses
  for select to authenticated
  using (private.is_staff());

revoke all on public.rental_agreements from public, anon, authenticated;
revoke all on public.agreement_items from public, anon, authenticated;
revoke all on public.agreement_clauses from public, anon, authenticated;
grant select on public.rental_agreements to authenticated;
grant select on public.agreement_items to authenticated;
grant select on public.agreement_clauses to authenticated;

create or replace function public.create_rental_agreement_for_request(
  target_rental_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  request_record public.rental_requests%rowtype;
  new_agreement_id uuid;
  normalized_item_count integer;
  invalid_item_count integer;
  agreement_subtotal numeric(12, 2);
  summary_equipment text;
  summary_start timestamptz;
  summary_end timestamptz;
  summary_duration text;
  clause_snapshot_value jsonb;
  terms_version_value text;
  conflicting_item_exists boolean;
begin
  if not private.is_staff() then
    raise exception using errcode = '42501',
      message = 'Staff authorization is required to create an Agreement.';
  end if;

  select * into request_record
  from public.rental_requests
  where id = target_rental_request_id
  for update;

  if not found then
    raise exception using errcode = 'P0002',
      message = 'Rental request not found.';
  end if;

  if request_record.status not in ('new', 'quote_sent', 'deposit_pending', 'confirmed') then
    raise exception using errcode = '55000',
      message = 'The rental request status does not permit Agreement creation.';
  end if;

  if request_record.customer_type not in ('individual', 'business')
    or nullif(btrim(request_record.full_name), '') is null
    or length(request_record.full_name) > 200
    or nullif(btrim(request_record.email), '') is null
    or length(request_record.email) > 320
    or nullif(btrim(request_record.phone), '') is null
    or length(request_record.phone) > 40
    or (
      request_record.customer_type = 'business'
      and nullif(btrim(request_record.business_name), '') is null
    ) then
    raise exception using errcode = '22023',
      message = 'Rental request customer information is incomplete or invalid.';
  end if;

  if request_record.availability_status not in ('available', 'approved') then
    raise exception using errcode = '55000',
      message = 'Availability must be confirmed before Agreement creation.';
  end if;

  if request_record.insurance_verification_status <> 'verified' then
    raise exception using errcode = '55000',
      message = 'Insurance must be verified before Agreement creation.';
  end if;

  if exists (
    select 1 from public.rental_agreements
    where rental_request_id = target_rental_request_id
  ) then
    raise exception using errcode = '23505',
      message = 'A Rental Agreement already exists for this request.';
  end if;

  clause_snapshot_value := private.current_agreement_clause_snapshot();
  if jsonb_array_length(clause_snapshot_value) = 0 then
    raise exception using errcode = '55000',
      message = 'At least one enabled legal clause is required.';
  end if;

  terms_version_value := 'sha256:' || pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(clause_snapshot_value::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  select count(*)::integer into normalized_item_count
  from public.rental_request_items
  where rental_request_id = target_rental_request_id;

  if normalized_item_count > 0 then
    if not private.is_feature_enabled('multi_item_rental_requests') then
      raise exception using errcode = '55000',
        message = 'Multi-item rental requests are not enabled.';
    end if;

    perform 1
    from private.rental_equipment_catalog catalog
    where catalog.equipment_id in (
      select items.equipment_id
      from public.rental_request_items items
      where items.rental_request_id = target_rental_request_id
    )
    order by catalog.equipment_id
    for update;

    select count(*)::integer into invalid_item_count
    from public.rental_request_items items
    left join private.rental_equipment_catalog catalog
      on catalog.equipment_id = items.equipment_id
    where items.rental_request_id = target_rental_request_id
      and (
        items.equipment_id is null
        or catalog.equipment_id is null
        or catalog.status <> 'active'
        or not catalog.rentable
        or nullif(btrim(items.equipment_name), '') is null
        or items.end_date < items.start_date
        or items.quantity <= 0
        or items.daily_rate < 0
        or (catalog.serialized and (
          items.quantity <> 1
          or nullif(btrim(items.serial_number), '') is null
        ))
      );

    if invalid_item_count > 0 then
      raise exception using errcode = '22023',
        message = 'Normalized rental-request items are invalid or no longer rentable.';
    end if;

    select exists (
      select 1
      from public.rental_request_items requested
      join public.agreement_items reserved
        on reserved.equipment_id = requested.equipment_id
       and requested.start_date <= reserved.end_date
       and reserved.start_date <= requested.end_date
      join public.rental_agreements agreements
        on agreements.id = reserved.rental_agreement_id
       and agreements.status <> 'cancelled'
      where requested.rental_request_id = target_rental_request_id
    ) into conflicting_item_exists;

    if conflicting_item_exists then
      raise exception using errcode = '55000',
        message = 'Availability revalidation found an existing Agreement conflict.';
    end if;

    select
      string_agg(items.equipment_name, ', ' order by items.display_order),
      min(items.start_date),
      max(items.end_date),
      sum(
        round(
          items.daily_rate
          * items.quantity
          * greatest(
            1,
            ceil(extract(epoch from (items.end_date - items.start_date)) / 86400)
          ),
          2
        )
      )::numeric(12, 2)
    into summary_equipment, summary_start, summary_end, agreement_subtotal
    from public.rental_request_items items
    where items.rental_request_id = target_rental_request_id;

    summary_duration := case
      when normalized_item_count = 1 then
        greatest(1, ceil(extract(epoch from (summary_end - summary_start)) / 86400))::integer::text
          || ' day'
          || case when greatest(1, ceil(extract(epoch from (summary_end - summary_start)) / 86400)) = 1
            then '' else 's' end
      else normalized_item_count::text || ' independently scheduled items'
    end;
  else
    if nullif(btrim(request_record.equipment_requested), '') is null
      or request_record.rental_start_date is null
      or request_record.rental_end_date is null
      or request_record.rental_end_date < request_record.rental_start_date then
      raise exception using errcode = '22023',
        message = 'The legacy rental request does not contain a valid item.';
    end if;

    summary_equipment := request_record.equipment_requested;
    summary_start := request_record.rental_start_date::timestamptz;
    summary_end := request_record.rental_end_date::timestamptz;
    agreement_subtotal := coalesce(request_record.quote_amount, 0);
    summary_duration := coalesce(
      nullif(request_record.rental_duration, ''),
      greatest(1, ceil(extract(epoch from (summary_end - summary_start)) / 86400))::integer::text
        || ' day'
        || case when greatest(1, ceil(extract(epoch from (summary_end - summary_start)) / 86400)) = 1
          then '' else 's' end
    );
  end if;

  insert into public.rental_agreements (
    rental_request_id,
    agreement_number,
    status,
    customer_type,
    customer_name,
    business_name,
    customer_email,
    customer_phone,
    billing_address,
    service_address,
    equipment_requested,
    rental_start_date,
    rental_end_date,
    rental_duration,
    fulfillment_type,
    quote_amount,
    deposit_amount,
    delivery_fee,
    tax_amount,
    total_amount,
    effective_at,
    signature_status,
    insurance_verification_status,
    availability_confirmation_status,
    terms_version,
    clause_snapshot,
    clause_snapshot_created_at
  ) values (
    request_record.id,
    private.next_rental_agreement_number(),
    'draft',
    request_record.customer_type,
    request_record.full_name,
    case when request_record.customer_type = 'business'
      then request_record.business_name else null end,
    request_record.email,
    request_record.phone,
    request_record.billing_address,
    request_record.service_address,
    summary_equipment,
    summary_start::date,
    summary_end::date,
    summary_duration,
    request_record.fulfillment_type,
    agreement_subtotal,
    0,
    0,
    0,
    agreement_subtotal,
    now(),
    'pending',
    request_record.insurance_verification_status,
    request_record.availability_status,
    terms_version_value,
    clause_snapshot_value,
    now()
  ) returning id into new_agreement_id;

  if normalized_item_count > 0 then
    insert into public.agreement_items (
      rental_agreement_id,
      rental_request_item_id,
      display_order,
      equipment_id,
      equipment_name,
      serial_number,
      start_date,
      end_date,
      quantity,
      daily_rate,
      billable_days,
      line_total,
      notes
    )
    select
      new_agreement_id,
      items.id,
      items.display_order,
      items.equipment_id,
      items.equipment_name,
      items.serial_number,
      items.start_date,
      items.end_date,
      items.quantity,
      items.daily_rate,
      greatest(
        1,
        ceil(extract(epoch from (items.end_date - items.start_date)) / 86400)
      )::integer,
      round(
        items.daily_rate
        * items.quantity
        * greatest(
          1,
          ceil(extract(epoch from (items.end_date - items.start_date)) / 86400)
        ),
        2
      ),
      items.notes
    from public.rental_request_items items
    where items.rental_request_id = target_rental_request_id
    order by items.display_order;
  else
    insert into public.agreement_items (
      rental_agreement_id,
      rental_request_item_id,
      display_order,
      equipment_id,
      equipment_name,
      serial_number,
      start_date,
      end_date,
      quantity,
      daily_rate,
      billable_days,
      line_total,
      notes
    ) values (
      new_agreement_id,
      null,
      0,
      null,
      summary_equipment,
      null,
      summary_start,
      summary_end,
      1,
      0,
      greatest(1, ceil(extract(epoch from (summary_end - summary_start)) / 86400))::integer,
      agreement_subtotal,
      request_record.notes
    );
  end if;

  return new_agreement_id;
end;
$$;

create or replace function public.update_rental_agreement_financials(
  target_agreement_id uuid,
  deposit_amount_value numeric,
  delivery_fee_value numeric,
  tax_amount_value numeric
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  agreement_record public.rental_agreements%rowtype;
begin
  if not private.is_staff() then
    raise exception using errcode = '42501',
      message = 'Staff authorization is required to update an Agreement.';
  end if;

  select * into agreement_record
  from public.rental_agreements
  where id = target_agreement_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Rental Agreement not found.';
  end if;

  if agreement_record.locked_at is not null or agreement_record.status <> 'draft' then
    raise exception using errcode = '55000',
      message = 'Only an unlocked draft Agreement can be updated.';
  end if;

  if deposit_amount_value is null or delivery_fee_value is null or tax_amount_value is null
    or deposit_amount_value < 0 or delivery_fee_value < 0 or tax_amount_value < 0
    or deposit_amount_value > 1000000 or delivery_fee_value > 1000000
    or tax_amount_value > 1000000 then
    raise exception using errcode = '22023',
      message = 'Agreement financial values must be reasonable nonnegative amounts.';
  end if;

  update public.rental_agreements
  set
    deposit_amount = round(deposit_amount_value, 2),
    delivery_fee = round(delivery_fee_value, 2),
    tax_amount = round(tax_amount_value, 2),
    total_amount = quote_amount
      + round(deposit_amount_value, 2)
      + round(delivery_fee_value, 2)
      + round(tax_amount_value, 2)
  where id = target_agreement_id;

  return target_agreement_id;
end;
$$;

create or replace function public.record_rental_agreement_acceptance(
  target_agreement_id uuid,
  signer_legal_name text,
  signer_title text,
  agreement_accepted boolean,
  card_authorization_acknowledged boolean
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  agreement_record public.rental_agreements%rowtype;
  request_record public.rental_requests%rowtype;
  clause_snapshot_value jsonb;
  terms_version_value text;
begin
  if not private.is_staff() then
    raise exception using errcode = '42501',
      message = 'Staff authorization is required to record Agreement acceptance.';
  end if;

  select * into agreement_record
  from public.rental_agreements
  where id = target_agreement_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Rental Agreement not found.';
  end if;

  if agreement_record.locked_at is not null or agreement_record.status <> 'draft' then
    raise exception using errcode = '55000',
      message = 'Only an unlocked draft Agreement can record acceptance.';
  end if;

  select * into request_record
  from public.rental_requests
  where id = agreement_record.rental_request_id
  for update;

  if request_record.availability_status not in ('available', 'approved') then
    raise exception using errcode = '55000',
      message = 'Availability must remain confirmed before acceptance.';
  end if;

  if request_record.insurance_verification_status <> 'verified' then
    raise exception using errcode = '55000',
      message = 'Insurance must remain verified before acceptance.';
  end if;

  if nullif(btrim(signer_legal_name), '') is null
    or length(signer_legal_name) > 200 then
    raise exception using errcode = '22023',
      message = 'A valid signer legal name is required.';
  end if;

  if signer_title is not null and length(signer_title) > 200 then
    raise exception using errcode = '22023',
      message = 'Signer title cannot exceed 200 characters.';
  end if;

  if agreement_accepted is not true then
    raise exception using errcode = '22023',
      message = 'Explicit Agreement acceptance is required.';
  end if;

  if card_authorization_acknowledged is not true then
    raise exception using errcode = '22023',
      message = 'Credit-card authorization acknowledgment is required.';
  end if;

  clause_snapshot_value := agreement_record.clause_snapshot;
  terms_version_value := agreement_record.terms_version;

  if coalesce(jsonb_array_length(clause_snapshot_value), 0) = 0
    or nullif(terms_version_value, '') is null then
    clause_snapshot_value := private.current_agreement_clause_snapshot();
    if jsonb_array_length(clause_snapshot_value) = 0 then
      raise exception using errcode = '55000',
        message = 'At least one enabled legal clause is required.';
    end if;
    terms_version_value := 'sha256:' || pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(clause_snapshot_value::text, 'UTF8'),
        'sha256'
      ),
      'hex'
    );
  end if;

  if not exists (
    select 1 from public.agreement_items
    where rental_agreement_id = target_agreement_id
  ) then
    if nullif(btrim(agreement_record.equipment_requested), '') is null
      or agreement_record.rental_start_date is null
      or agreement_record.rental_end_date is null
      or agreement_record.rental_end_date < agreement_record.rental_start_date then
      raise exception using errcode = '22023',
        message = 'The legacy Agreement does not contain a valid item snapshot.';
    end if;

    insert into public.agreement_items (
      rental_agreement_id,
      rental_request_item_id,
      display_order,
      equipment_id,
      equipment_name,
      serial_number,
      start_date,
      end_date,
      quantity,
      daily_rate,
      billable_days,
      line_total,
      notes
    ) values (
      target_agreement_id,
      null,
      0,
      null,
      agreement_record.equipment_requested,
      null,
      agreement_record.rental_start_date::timestamptz,
      agreement_record.rental_end_date::timestamptz,
      1,
      0,
      greatest(
        1,
        ceil(
          extract(epoch from (
            agreement_record.rental_end_date::timestamptz
            - agreement_record.rental_start_date::timestamptz
          )) / 86400
        )
      )::integer,
      agreement_record.quote_amount,
      null
    );
  end if;

  update public.rental_agreements
  set
    signature_status = 'accepted',
    acceptance_acknowledged = true,
    authorized_signer_name = btrim(signer_legal_name),
    authorized_signer_title = nullif(btrim(signer_title), ''),
    accepted_terms_version = terms_version_value,
    credit_card_authorization_acknowledged = true,
    credit_card_authorization_acknowledged_at = now(),
    insurance_verification_status = request_record.insurance_verification_status,
    availability_confirmation_status = request_record.availability_status,
    terms_version = terms_version_value,
    clause_snapshot = clause_snapshot_value,
    clause_snapshot_created_at = coalesce(clause_snapshot_created_at, now()),
    signed_at = now(),
    signed_by = private.current_staff_actor_id()
  where id = target_agreement_id;

  return target_agreement_id;
end;
$$;

create or replace function public.finalize_rental_agreement(
  target_agreement_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  agreement_record public.rental_agreements%rowtype;
  request_record public.rental_requests%rowtype;
begin
  if not private.is_staff() then
    raise exception using errcode = '42501',
      message = 'Staff authorization is required to finalize an Agreement.';
  end if;

  select * into agreement_record
  from public.rental_agreements
  where id = target_agreement_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Rental Agreement not found.';
  end if;

  if agreement_record.locked_at is not null or agreement_record.status <> 'draft' then
    raise exception using errcode = '55000',
      message = 'Only an unlocked draft Agreement can be finalized.';
  end if;

  select * into request_record
  from public.rental_requests
  where id = agreement_record.rental_request_id
  for update;

  if request_record.availability_status not in ('available', 'approved') then
    raise exception using errcode = '55000',
      message = 'Availability confirmation is no longer valid.';
  end if;

  if request_record.insurance_verification_status <> 'verified' then
    raise exception using errcode = '55000',
      message = 'Insurance verification is no longer valid.';
  end if;

  if jsonb_array_length(agreement_record.clause_snapshot) = 0
    or nullif(agreement_record.terms_version, '') is null then
    raise exception using errcode = '55000',
      message = 'The Agreement legal snapshot is incomplete.';
  end if;

  if agreement_record.signature_status <> 'accepted'
    or agreement_record.acceptance_acknowledged is not true
    or agreement_record.credit_card_authorization_acknowledged is not true
    or nullif(btrim(agreement_record.authorized_signer_name), '') is null
    or agreement_record.signed_at is null
    or agreement_record.accepted_terms_version is distinct from agreement_record.terms_version then
    raise exception using errcode = '55000',
      message = 'Complete Agreement acceptance evidence is required.';
  end if;

  if not exists (
    select 1 from public.agreement_items
    where rental_agreement_id = target_agreement_id
  ) then
    raise exception using errcode = '55000',
      message = 'At least one Agreement item is required.';
  end if;

  update public.rental_agreements
  set status = 'ready', locked_at = now()
  where id = target_agreement_id;

  return target_agreement_id;
end;
$$;

revoke all on function private.current_staff_actor_id()
  from public, anon, authenticated;
revoke all on function private.next_rental_agreement_number()
  from public, anon, authenticated;
revoke all on function private.current_agreement_clause_snapshot()
  from public, anon, authenticated;
revoke all on function private.prevent_agreement_item_mutation()
  from public, anon, authenticated;
revoke all on function private.protect_rental_agreement_snapshot()
  from public, anon, authenticated;

revoke all on function public.create_rental_agreement_for_request(uuid)
  from public, anon, authenticated;
grant execute on function public.create_rental_agreement_for_request(uuid)
  to authenticated;

revoke all on function public.update_rental_agreement_financials(uuid, numeric, numeric, numeric)
  from public, anon, authenticated;
grant execute on function public.update_rental_agreement_financials(uuid, numeric, numeric, numeric)
  to authenticated;

revoke all on function public.record_rental_agreement_acceptance(uuid, text, text, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.record_rental_agreement_acceptance(uuid, text, text, boolean, boolean)
  to authenticated;

revoke all on function public.finalize_rental_agreement(uuid)
  from public, anon, authenticated;
grant execute on function public.finalize_rental_agreement(uuid)
  to authenticated;

comment on function public.create_rental_agreement_for_request(uuid) is
  'Staff-only transaction that locks a request and creates one immutable Agreement aggregate from server data.';
comment on table public.agreement_items is
  'Immutable legal item snapshots created only through the Agreement transaction.';
