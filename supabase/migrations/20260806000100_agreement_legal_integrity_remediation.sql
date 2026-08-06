-- Sprint 2B-B.1 Agreement legal-integrity remediation.
-- This forward-only migration binds acceptance to the complete stored Agreement
-- snapshot, centralizes lifecycle and serialized-overlap rules, and leaves both
-- Release 1 rollout gates disabled.

alter table public.rental_agreements
  add column if not exists snapshot_schema_version integer,
  add column if not exists current_snapshot_hash text,
  add column if not exists accepted_snapshot_hash text,
  add column if not exists credit_card_authorization_terms text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.rental_agreements'::regclass
      and conname = 'rental_agreements_snapshot_schema_version_check'
  ) then
    alter table public.rental_agreements
      add constraint rental_agreements_snapshot_schema_version_check
      check (snapshot_schema_version is null or snapshot_schema_version = 1)
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.rental_agreements'::regclass
      and conname = 'rental_agreements_current_snapshot_hash_check'
  ) then
    alter table public.rental_agreements
      add constraint rental_agreements_current_snapshot_hash_check
      check (
        current_snapshot_hash is null
        or current_snapshot_hash ~ '^sha256:[0-9a-f]{64}$'
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.rental_agreements'::regclass
      and conname = 'rental_agreements_accepted_snapshot_hash_check'
  ) then
    alter table public.rental_agreements
      add constraint rental_agreements_accepted_snapshot_hash_check
      check (
        accepted_snapshot_hash is null
        or accepted_snapshot_hash ~ '^sha256:[0-9a-f]{64}$'
      ) not valid;
  end if;
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

  if agreement_record.acceptance_acknowledged is true
    or agreement_record.signature_status in ('accepted', 'signed')
    or agreement_record.accepted_snapshot_hash is not null then
    raise exception using errcode = '55000',
      message = 'Accepted Agreement material terms cannot be changed.';
  end if;

  if agreement_record.snapshot_schema_version <> 1
    or nullif(agreement_record.credit_card_authorization_terms, '') is null
    or coalesce(jsonb_array_length(agreement_record.clause_snapshot), 0) = 0
    or nullif(agreement_record.terms_version, '') is null then
    raise exception using errcode = '55000',
      message = 'The Agreement does not contain a verified material snapshot.';
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

  update public.rental_agreements
  set current_snapshot_hash = private.rental_agreement_snapshot_hash(target_agreement_id)
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
  calculated_snapshot_hash text;
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

  if agreement_record.acceptance_acknowledged is true
    or agreement_record.signature_status in ('accepted', 'signed')
    or agreement_record.accepted_snapshot_hash is not null then
    raise exception using errcode = '55000',
      message = 'Agreement acceptance has already been recorded.';
  end if;

  select * into request_record
  from public.rental_requests
  where id = agreement_record.rental_request_id
  for update;

  if not found then
    raise exception using errcode = 'P0002',
      message = 'The Agreement rental request was not found.';
  end if;

  perform private.assert_rental_request_agreement_eligible(request_record.status);

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

  if agreement_record.snapshot_schema_version <> 1
    or coalesce(jsonb_array_length(agreement_record.clause_snapshot), 0) = 0
    or nullif(agreement_record.terms_version, '') is null
    or agreement_record.terms_version is distinct from
      private.agreement_clause_snapshot_hash(agreement_record.clause_snapshot)
    or agreement_record.clause_snapshot_created_at is null
    or nullif(agreement_record.credit_card_authorization_terms, '') is null
    or not exists (
      select 1 from public.agreement_items
      where rental_agreement_id = target_agreement_id
    ) then
    raise exception using errcode = '55000',
      message = 'The Agreement does not contain a verified immutable snapshot.';
  end if;

  calculated_snapshot_hash := private.rental_agreement_snapshot_hash(target_agreement_id);
  if calculated_snapshot_hash is null then
    raise exception using errcode = '55000',
      message = 'The Agreement material snapshot could not be verified.';
  end if;

  update public.rental_agreements
  set
    signature_status = 'accepted',
    acceptance_acknowledged = true,
    authorized_signer_name = btrim(signer_legal_name),
    authorized_signer_title = nullif(btrim(signer_title), ''),
    accepted_terms_version = terms_version,
    current_snapshot_hash = calculated_snapshot_hash,
    accepted_snapshot_hash = calculated_snapshot_hash,
    credit_card_authorization_acknowledged = true,
    credit_card_authorization_acknowledged_at = now(),
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
  calculated_snapshot_hash text;
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

  if not found then
    raise exception using errcode = 'P0002',
      message = 'The Agreement rental request was not found.';
  end if;

  perform private.assert_rental_request_agreement_eligible(request_record.status);

  if request_record.availability_status not in ('available', 'approved') then
    raise exception using errcode = '55000',
      message = 'Availability confirmation is no longer valid.';
  end if;

  if request_record.insurance_verification_status <> 'verified' then
    raise exception using errcode = '55000',
      message = 'Insurance verification is no longer valid.';
  end if;

  if agreement_record.snapshot_schema_version <> 1
    or coalesce(jsonb_array_length(agreement_record.clause_snapshot), 0) = 0
    or nullif(agreement_record.terms_version, '') is null
    or agreement_record.terms_version is distinct from
      private.agreement_clause_snapshot_hash(agreement_record.clause_snapshot)
    or agreement_record.clause_snapshot_created_at is null
    or nullif(agreement_record.credit_card_authorization_terms, '') is null
    or agreement_record.current_snapshot_hash is null then
    raise exception using errcode = '55000',
      message = 'The Agreement immutable snapshot is incomplete.';
  end if;

  if agreement_record.signature_status <> 'accepted'
    or agreement_record.acceptance_acknowledged is not true
    or agreement_record.credit_card_authorization_acknowledged is not true
    or nullif(btrim(agreement_record.authorized_signer_name), '') is null
    or agreement_record.signed_at is null
    or agreement_record.accepted_snapshot_hash is null
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

  calculated_snapshot_hash := private.rental_agreement_snapshot_hash(target_agreement_id);
  if calculated_snapshot_hash is distinct from agreement_record.current_snapshot_hash
    or calculated_snapshot_hash is distinct from agreement_record.accepted_snapshot_hash then
    raise exception using errcode = '55000',
      message = 'The Agreement material snapshot does not match the accepted snapshot.';
  end if;

  update public.rental_agreements
  set status = 'ready', locked_at = now()
  where id = target_agreement_id;

  return target_agreement_id;
end;
$$;

alter table public.rental_agreements
  validate constraint rental_agreements_snapshot_schema_version_check;
alter table public.rental_agreements
  validate constraint rental_agreements_current_snapshot_hash_check;
alter table public.rental_agreements
  validate constraint rental_agreements_accepted_snapshot_hash_check;

create or replace function private.current_credit_card_authorization_terms()
returns text
language sql
immutable
security definer
set search_path = pg_catalog, private
as $$
  select 'The signer authorizes Urban Cowboy Rentals to use the approved payment provider for Agreement charges and acknowledges that full card numbers and CVV values are not stored by this application.'::text;
$$;

create or replace function private.agreement_clause_snapshot_hash(
  clause_snapshot_value jsonb
)
returns text
language sql
immutable
security definer
set search_path = pg_catalog, public, private
as $$
  select 'sha256:' || pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(clause_snapshot_value::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function private.assert_rental_request_agreement_eligible(
  request_status text
)
returns void
language plpgsql
immutable
security definer
set search_path = pg_catalog, private
as $$
begin
  if request_status is null
    or request_status not in ('new', 'quote_sent', 'deposit_pending', 'confirmed') then
    raise exception using errcode = '55000',
      message = 'Rental request lifecycle status does not permit Agreement processing.';
  end if;
end;
$$;

create or replace function private.assert_no_serialized_item_overlaps(
  authoritative_items jsonb
)
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, private
as $$
declare
  overlap_exists boolean;
begin
  if authoritative_items is null
    or jsonb_typeof(authoritative_items) <> 'array'
    or jsonb_array_length(authoritative_items) < 2 then
    return;
  end if;

  select exists (
    select 1
    from jsonb_array_elements(authoritative_items) with ordinality first_item(value, ordinal)
    join jsonb_array_elements(authoritative_items) with ordinality second_item(value, ordinal)
      on first_item.ordinal < second_item.ordinal
     and nullif(btrim(first_item.value ->> 'serial_number'), '') is not null
     and first_item.value ->> 'serial_number' = second_item.value ->> 'serial_number'
     and (first_item.value ->> 'start_date')::timestamptz
       <= (second_item.value ->> 'end_date')::timestamptz
     and (second_item.value ->> 'start_date')::timestamptz
       <= (first_item.value ->> 'end_date')::timestamptz
  ) into overlap_exists;

  if overlap_exists then
    raise exception using errcode = '22023',
      message = 'A serialized equipment unit cannot have overlapping rental periods in one request.';
  end if;
end;
$$;

create or replace function private.authoritative_item_payloads(
  item_payloads jsonb,
  earliest_start timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, private
as $$
declare
  authoritative_items jsonb;
begin
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
    ) order by display_order
  ) into authoritative_items
  from private.authoritative_rental_request_items(item_payloads, earliest_start);

  perform private.assert_no_serialized_item_overlaps(authoritative_items);
  return authoritative_items;
end;
$$;

create or replace function private.rental_agreement_material_snapshot(
  target_agreement_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select jsonb_build_object(
    'snapshot_schema_version', 1,
    'agreement', jsonb_build_object(
      'id', agreements.id,
      'agreement_number', agreements.agreement_number,
      'rental_request_id', agreements.rental_request_id,
      'effective_at_utc', to_char(
        agreements.effective_at at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
      ),
      'customer_type', agreements.customer_type,
      'customer_legal_name', agreements.customer_name,
      'business_name', agreements.business_name,
      'email', agreements.customer_email,
      'phone', agreements.customer_phone,
      'billing_address', agreements.billing_address,
      'service_address', agreements.service_address,
      'fulfillment_type', agreements.fulfillment_type,
      'rental_duration', agreements.rental_duration,
      'agreement_html', agreements.agreement_html,
      'equipment_summary', agreements.equipment_requested,
      'rental_start_date', agreements.rental_start_date,
      'rental_end_date', agreements.rental_end_date
    ),
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', items.id,
            'rental_request_item_id', items.rental_request_item_id,
            'display_order', items.display_order,
            'equipment_id', items.equipment_id,
            'equipment_name', items.equipment_name,
            'serial_number', items.serial_number,
            'start_date_utc', to_char(
              items.start_date at time zone 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
            ),
            'end_date_utc', to_char(
              items.end_date at time zone 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
            ),
            'quantity', items.quantity,
            'daily_rate', round(items.daily_rate, 2),
            'billable_days', items.billable_days,
            'line_subtotal', round(items.line_total, 2),
            'notes', items.notes
          ) order by items.display_order, items.id
        )
        from public.agreement_items items
        where items.rental_agreement_id = agreements.id
      ),
      '[]'::jsonb
    ),
    'pricing', jsonb_build_object(
      'subtotal', round(agreements.quote_amount, 2),
      'deposit', round(agreements.deposit_amount, 2),
      'delivery_charge', round(agreements.delivery_fee, 2),
      'tax', round(agreements.tax_amount, 2),
      'other_ancillary_charges', '[]'::jsonb,
      'final_total', round(agreements.total_amount, 2)
    ),
    'legal', jsonb_build_object(
      'clause_snapshot_hash', agreements.terms_version,
      'clause_snapshot', agreements.clause_snapshot
    ),
    'credit_card_authorization', jsonb_build_object(
      'terms', agreements.credit_card_authorization_terms
    )
  )
  from public.rental_agreements agreements
  where agreements.id = target_agreement_id;
$$;

create or replace function private.rental_agreement_snapshot_hash(
  target_agreement_id uuid
)
returns text
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select 'sha256:' || pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        private.rental_agreement_material_snapshot(target_agreement_id)::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

-- Draft Agreements that already contain persisted legal and item snapshots can
-- safely receive the new deterministic hash. Finalized historical Agreements
-- and incomplete legacy drafts remain explicitly unverified and are not altered.
update public.rental_agreements agreements
set
  snapshot_schema_version = 1,
  credit_card_authorization_terms = private.current_credit_card_authorization_terms()
where agreements.locked_at is null
  and agreements.acceptance_acknowledged is not true
  and agreements.signature_status = 'pending'
  and agreements.accepted_terms_version is null
  and coalesce(jsonb_array_length(agreements.clause_snapshot), 0) > 0
  and nullif(agreements.terms_version, '') is not null
  and agreements.terms_version =
    private.agreement_clause_snapshot_hash(agreements.clause_snapshot)
  and exists (
    select 1 from public.agreement_items items
    where items.rental_agreement_id = agreements.id
  );

update public.rental_agreements agreements
set current_snapshot_hash = private.rental_agreement_snapshot_hash(agreements.id)
where agreements.locked_at is null
  and agreements.acceptance_acknowledged is not true
  and agreements.signature_status = 'pending'
  and agreements.accepted_terms_version is null
  and agreements.snapshot_schema_version = 1
  and nullif(agreements.credit_card_authorization_terms, '') is not null
  and coalesce(jsonb_array_length(agreements.clause_snapshot), 0) > 0
  and nullif(agreements.terms_version, '') is not null
  and exists (
    select 1 from public.agreement_items items
    where items.rental_agreement_id = agreements.id
  );

create or replace function private.protect_rental_agreement_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  acceptance_already_recorded boolean;
begin
  acceptance_already_recorded :=
    old.acceptance_acknowledged is true
    or old.signature_status in ('accepted', 'signed')
    or old.accepted_snapshot_hash is not null;

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
    or old.agreement_html is distinct from new.agreement_html
    or old.quote_amount is distinct from new.quote_amount
    or old.effective_at is distinct from new.effective_at
    or old.insurance_verification_status is distinct from new.insurance_verification_status
    or old.availability_confirmation_status is distinct from new.availability_confirmation_status
    or old.terms_version is distinct from new.terms_version
    or old.clause_snapshot is distinct from new.clause_snapshot
    or old.clause_snapshot_created_at is distinct from new.clause_snapshot_created_at
    or old.snapshot_schema_version is distinct from new.snapshot_schema_version
    or old.credit_card_authorization_terms is distinct from new.credit_card_authorization_terms then
    raise exception using errcode = '55000',
      message = 'Agreement legal, customer, and item-summary snapshots are immutable.';
  end if;

  if acceptance_already_recorded and (
    old.deposit_amount is distinct from new.deposit_amount
    or old.delivery_fee is distinct from new.delivery_fee
    or old.tax_amount is distinct from new.tax_amount
    or old.total_amount is distinct from new.total_amount
    or old.current_snapshot_hash is distinct from new.current_snapshot_hash
    or old.accepted_snapshot_hash is distinct from new.accepted_snapshot_hash
    or old.accepted_terms_version is distinct from new.accepted_terms_version
  ) then
    raise exception using errcode = '55000',
      message = 'Accepted Agreement material terms are immutable.';
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
  serialized_items jsonb;
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

  perform private.assert_rental_request_agreement_eligible(request_record.status);

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

  terms_version_value := private.agreement_clause_snapshot_hash(clause_snapshot_value);

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

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'serial_number', items.serial_number,
          'start_date', items.start_date,
          'end_date', items.end_date
        ) order by items.display_order, items.id
      ),
      '[]'::jsonb
    ) into serialized_items
    from public.rental_request_items items
    join private.rental_equipment_catalog catalog
      on catalog.equipment_id = items.equipment_id
     and catalog.serialized
    where items.rental_request_id = target_rental_request_id;

    perform private.assert_no_serialized_item_overlaps(serialized_items);

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
    clause_snapshot_created_at,
    snapshot_schema_version,
    credit_card_authorization_terms
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
    now(),
    1,
    private.current_credit_card_authorization_terms()
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

  update public.rental_agreements
  set current_snapshot_hash = private.rental_agreement_snapshot_hash(new_agreement_id)
  where id = new_agreement_id;

  return new_agreement_id;
end;
$$;

revoke all on function private.current_credit_card_authorization_terms()
  from public, anon, authenticated;
revoke all on function private.agreement_clause_snapshot_hash(jsonb)
  from public, anon, authenticated;
revoke all on function private.assert_rental_request_agreement_eligible(text)
  from public, anon, authenticated;
revoke all on function private.assert_no_serialized_item_overlaps(jsonb)
  from public, anon, authenticated;
revoke all on function private.authoritative_item_payloads(jsonb, timestamptz)
  from public, anon, authenticated;
revoke all on function private.rental_agreement_material_snapshot(uuid)
  from public, anon, authenticated;
revoke all on function private.rental_agreement_snapshot_hash(uuid)
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

comment on function private.rental_agreement_material_snapshot(uuid) is
  'Deterministic schema-v1 representation of complete stored material Agreement terms; excludes mutable workflow timestamps.';
comment on function private.assert_no_serialized_item_overlaps(jsonb) is
  'Shared inclusive-range overlap rule for authoritative serialized equipment payloads.';
comment on column public.rental_agreements.current_snapshot_hash is
  'SHA-256 hash of the current complete stored material Agreement snapshot.';
comment on column public.rental_agreements.accepted_snapshot_hash is
  'Exact complete Agreement snapshot hash bound to recorded acceptance evidence.';
comment on column public.rental_agreements.snapshot_schema_version is
  'Deterministic material-snapshot schema version. NULL represents an unverified legacy snapshot.';
