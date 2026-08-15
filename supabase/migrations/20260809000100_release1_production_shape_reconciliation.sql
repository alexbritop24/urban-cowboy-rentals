-- Release 1 production-shape reconciliation.
-- Fresh databases reach the same result after the corrected pending migrations;
-- already-migrated preview databases use this forward migration to converge
-- without mutating or fabricating historical business records.

drop index if exists public.rental_agreements_rental_request_key;

do $$
begin
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
    select rental_request_id
    from public.rental_agreements
    where snapshot_schema_version = 1
      and status <> 'cancelled'
    group by rental_request_id
    having count(*) > 1
  ) then
    raise exception using errcode = '23505',
      message = 'Cannot enforce one Release 1 Agreement per request while duplicate verified snapshots exist.';
  end if;
end;
$$;

create unique index if not exists rental_agreements_canonical_request_key
  on public.rental_agreements (rental_request_id)
  where status in ('sent', 'viewed', 'ready', 'signed');

create unique index if not exists rental_agreements_release1_request_key
  on public.rental_agreements (rental_request_id)
  where snapshot_schema_version = 1 and status <> 'cancelled';

-- Replace every FK on each exact single-column relationship. Matching by table,
-- columns, and referenced relation avoids relying on historical constraint names.
do $$
declare
  relationship record;
  existing_constraint record;
  source_relation regclass;
  target_relation regclass;
begin
  for relationship in
    select *
    from (
      values
        ('public', 'rental_agreements', 'rental_request_id',
          'public', 'rental_requests', 'id',
          'rental_agreements_rental_request_fk'),
        ('public', 'invoices', 'rental_agreement_id',
          'public', 'rental_agreements', 'id',
          'invoices_rental_agreement_fk'),
        ('public', 'invoices', 'rental_request_id',
          'public', 'rental_requests', 'id',
          'invoices_rental_request_fk'),
        ('public', 'payments', 'invoice_id',
          'public', 'invoices', 'id',
          'payments_invoice_fk')
    ) as relationships(
      source_schema, source_table, source_column,
      target_schema, target_table, target_column,
      final_constraint_name
    )
  loop
    source_relation := pg_catalog.to_regclass(
      pg_catalog.format('%I.%I', relationship.source_schema, relationship.source_table)
    );
    target_relation := pg_catalog.to_regclass(
      pg_catalog.format('%I.%I', relationship.target_schema, relationship.target_table)
    );

    if source_relation is null or target_relation is null then
      raise exception using errcode = '42P01',
        message = pg_catalog.format(
          'Required FK relation is missing for %.%.',
          relationship.source_table,
          relationship.source_column
        );
    end if;

    for existing_constraint in
      select constraints.conname
      from pg_catalog.pg_constraint constraints
      join pg_catalog.pg_attribute source_attribute
        on source_attribute.attrelid = constraints.conrelid
       and source_attribute.attnum = constraints.conkey[1]
      join pg_catalog.pg_attribute target_attribute
        on target_attribute.attrelid = constraints.confrelid
       and target_attribute.attnum = constraints.confkey[1]
      where constraints.contype = 'f'
        and constraints.conrelid = source_relation
        and constraints.confrelid = target_relation
        and pg_catalog.cardinality(constraints.conkey) = 1
        and pg_catalog.cardinality(constraints.confkey) = 1
        and source_attribute.attname = relationship.source_column
        and target_attribute.attname = relationship.target_column
    loop
      execute pg_catalog.format(
        'alter table %I.%I drop constraint %I',
        relationship.source_schema,
        relationship.source_table,
        existing_constraint.conname
      );
    end loop;

    execute pg_catalog.format(
      'alter table %I.%I add constraint %I foreign key (%I) references %I.%I (%I) on update restrict on delete restrict not valid',
      relationship.source_schema,
      relationship.source_table,
      relationship.final_constraint_name,
      relationship.source_column,
      relationship.target_schema,
      relationship.target_table,
      relationship.target_column
    );

    execute pg_catalog.format(
      'alter table %I.%I validate constraint %I',
      relationship.source_schema,
      relationship.source_table,
      relationship.final_constraint_name
    );
  end loop;
end;
$$;

-- Sequence reconciliation never rewrites historical numbers and never moves a
-- sequence backwards. setval(max, true) makes the next generated value max + 1.
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

do $$
declare
  maximum_existing_suffix bigint;
  sequence_last_value bigint;
  sequence_is_called boolean;
  highest_allocated_value bigint;
begin
  select max((regexp_match(
    invoice_number,
    '^INV-[0-9]{4}-([0-9]{6})$'
  ))[1]::bigint)
  into maximum_existing_suffix
  from public.invoices
  where invoice_number ~ '^INV-[0-9]{4}-[0-9]{6}$';

  select last_value, is_called
  into sequence_last_value, sequence_is_called
  from public.invoice_number_seq;

  highest_allocated_value := case
    when sequence_is_called then sequence_last_value
    else sequence_last_value - 1
  end;

  if coalesce(maximum_existing_suffix, 0) > highest_allocated_value then
    perform pg_catalog.setval(
      'public.invoice_number_seq'::pg_catalog.regclass,
      maximum_existing_suffix,
      true
    );
  end if;
end;
$$;

-- Replace the two functions that select and lock an Agreement by request so
-- already-migrated environments use the same canonical selection as fresh ones.

create or replace function private.canonical_rental_agreement_id(
  target_rental_request_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select agreements.id
  from public.rental_agreements agreements
  where agreements.rental_request_id = target_rental_request_id
  order by
    case
      when agreements.status in ('ready', 'signed')
        and agreements.locked_at is not null then 0
      when agreements.status in ('sent', 'viewed', 'ready', 'signed') then 1
      when agreements.status = 'draft' then 2
      when agreements.status = 'cancelled' then 3
      else 4
    end,
    agreements.locked_at desc nulls last,
    agreements.created_at desc,
    agreements.id desc
  limit 1;
$$;

create or replace function private.rental_approval_checklist(
  target_rental_request_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, private
as $$
declare
  request_record public.rental_requests%rowtype;
  agreement_record public.rental_agreements%rowtype;
  current_schedule_hash text;
  current_insurance_id uuid;
  initial_check public.rental_availability_checks%rowtype;
  final_check public.rental_availability_checks%rowtype;
  item_state text;
  item_reason text;
  initial_state text;
  initial_reason text;
  license_state text;
  insurance_state text;
  verification_state text;
  card_state text;
  acceptance_state text;
  agreement_state text;
  final_state text;
  final_reason text;
  payment_gate jsonb;
  display_approval_state text;
  all_pre_final_pass boolean;
begin
  select * into request_record
  from public.rental_requests
  where id = target_rental_request_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Rental request not found.';
  end if;

  select * into agreement_record
  from public.rental_agreements
  where id = private.canonical_rental_agreement_id(target_rental_request_id);

  current_schedule_hash := private.rental_approval_schedule_hash(
    target_rental_request_id
  );

  if private.rental_approval_item_data_complete(target_rental_request_id) then
    item_state := 'pass';
    item_reason := 'Authoritative item data is complete.';
  else
    item_state := 'fail';
    item_reason := 'Equipment items require valid resource identity, dates, and quantity.';
  end if;

  select * into initial_check
  from public.rental_availability_checks checks
  where checks.rental_request_id = target_rental_request_id
    and checks.check_type = 'initial'
  order by checks.checked_at desc, checks.id desc
  limit 1;

  if initial_check.id is null then
    initial_state := 'pending';
    initial_reason := 'Initial availability has not been confirmed.';
  elsif initial_check.schedule_hash is distinct from current_schedule_hash then
    initial_state := 'stale';
    initial_reason := 'Initial availability confirmation is stale.';
  elsif initial_check.result <> 'available' then
    initial_state := 'fail';
    initial_reason := 'The latest initial availability check found a conflict.';
  else
    initial_state := 'pass';
    initial_reason := 'Initial availability matches the current schedule.';
  end if;

  if exists (
    select 1 from public.rental_documents documents
    where documents.rental_request_id = target_rental_request_id
      and documents.document_type = 'driver_license'
      and documents.is_current
  ) then
    license_state := 'pass';
  else
    license_state := 'fail';
  end if;

  select documents.id into current_insurance_id
  from public.rental_documents documents
  where documents.rental_request_id = target_rental_request_id
    and documents.document_type = 'insurance'
    and documents.is_current;
  insurance_state := case when current_insurance_id is null then 'fail' else 'pass' end;
  verification_state := case
    when current_insurance_id is not null
      and request_record.insurance_verification_status = 'verified'
      and request_record.insurance_reviewed_document_id = current_insurance_id
      then 'pass'
    else 'fail'
  end;

  card_state := case
    when agreement_record.id is not null
      and agreement_record.credit_card_authorization_acknowledged
      and agreement_record.credit_card_authorization_acknowledged_at is not null
      and nullif(agreement_record.credit_card_authorization_terms, '') is not null
      then 'pass'
    else 'fail'
  end;

  acceptance_state := case
    when agreement_record.id is not null
      and agreement_record.acceptance_acknowledged
      and agreement_record.signature_status in ('accepted', 'signed')
      and agreement_record.signed_at is not null
      and nullif(btrim(agreement_record.authorized_signer_name), '') is not null
      and agreement_record.accepted_snapshot_hash is not null
      and agreement_record.accepted_snapshot_hash = agreement_record.current_snapshot_hash
      then 'pass'
    else 'fail'
  end;

  agreement_state := case
    when agreement_record.id is not null
      and agreement_record.status = 'ready'
      and agreement_record.locked_at is not null
      and agreement_record.current_snapshot_hash is not null
      and agreement_record.accepted_snapshot_hash = agreement_record.current_snapshot_hash
      then 'pass'
    else 'fail'
  end;

  payment_gate := private.rental_approval_payment_gate(target_rental_request_id);

  select checks.* into final_check
  from public.rental_approval_events events
  join public.rental_availability_checks checks
    on checks.id = events.availability_check_id
  where events.rental_request_id = target_rental_request_id
    and events.event_type = 'approved'
  order by events.occurred_at desc, events.id desc
  limit 1;

  if request_record.approval_status <> 'approved' then
    select checks.* into final_check
    from public.rental_availability_checks checks
    where checks.rental_request_id = target_rental_request_id
      and checks.check_type = 'final'
    order by checks.checked_at desc, checks.id desc
    limit 1;
  end if;

  if request_record.approval_status = 'approved'
    and final_check.id is not null
    and final_check.result = 'available'
    and final_check.schedule_hash = current_schedule_hash then
    final_state := 'pass';
    final_reason := 'Final availability was revalidated in the approval transaction.';
  elsif request_record.approval_status = 'reversed' then
    final_state := 'stale';
    final_reason := 'Approval was reversed; reapproval requires a new final check.';
  elsif final_check.id is not null
    and final_check.schedule_hash = current_schedule_hash
    and final_check.result = 'conflict' then
    final_state := 'fail';
    final_reason := 'The latest final availability revalidation found a conflict.';
  else
    final_state := 'pending';
    final_reason := 'Final availability is checked transactionally during approval.';
  end if;

  display_approval_state := request_record.approval_status;
  if request_record.approval_status = 'pending'
    and not exists (
      select 1 from public.rental_approval_events events
      where events.rental_request_id = target_rental_request_id
    )
    and request_record.status in (
      'confirmed', 'preparing_equipment', 'scheduled_delivery',
      'pickup_scheduled', 'active_rental', 'return_due', 'returned',
      'inspection', 'completed'
    ) then
    display_approval_state := 'legacy_unverified';
  end if;

  all_pre_final_pass := item_state = 'pass'
    and initial_state = 'pass'
    and license_state = 'pass'
    and insurance_state = 'pass'
    and verification_state = 'pass'
    and card_state = 'pass'
    and acceptance_state = 'pass'
    and agreement_state = 'pass'
    and payment_gate ->> 'state' = 'pass';

  return pg_catalog.jsonb_build_object(
    'rentalRequestId', target_rental_request_id,
    'approvalState', display_approval_state,
    'approvedBy', request_record.approved_by,
    'approvedAt', request_record.approved_at,
    'reversedBy', request_record.approval_reversed_by,
    'reversedAt', request_record.approval_reversed_at,
    'reversalNote', request_record.approval_reversal_note,
    'scheduleHash', current_schedule_hash,
    'paymentPolicy', payment_gate ->> 'policy',
    'checks', pg_catalog.jsonb_build_object(
      'item_data_complete', pg_catalog.jsonb_build_object(
        'state', item_state, 'reason', item_reason
      ),
      'initial_availability', pg_catalog.jsonb_build_object(
        'state', initial_state, 'reason', initial_reason
      ),
      'driver_license', pg_catalog.jsonb_build_object(
        'state', license_state,
        'reason', case when license_state = 'pass'
          then 'A current driver license is registered.'
          else 'A current driver license is required.' end
      ),
      'insurance', pg_catalog.jsonb_build_object(
        'state', insurance_state,
        'reason', case when insurance_state = 'pass'
          then 'A current insurance document is registered.'
          else 'A current insurance document is required.' end
      ),
      'insurance_verification', pg_catalog.jsonb_build_object(
        'state', verification_state,
        'reason', case when verification_state = 'pass'
          then 'The current insurance document is verified.'
          else 'The current insurance document must be verified.' end
      ),
      'card_authorization', pg_catalog.jsonb_build_object(
        'state', card_state,
        'reason', case when card_state = 'pass'
          then 'Credit-card authorization was acknowledged in the Agreement.'
          else 'Agreement credit-card authorization is required.' end
      ),
      'acceptance', pg_catalog.jsonb_build_object(
        'state', acceptance_state,
        'reason', case when acceptance_state = 'pass'
          then 'Customer acceptance matches the Agreement snapshot.'
          else 'Customer acceptance evidence must match the Agreement snapshot.' end
      ),
      'agreement_final', pg_catalog.jsonb_build_object(
        'state', agreement_state,
        'reason', case when agreement_state = 'pass'
          then 'The immutable Agreement is finalized.'
          else 'The Agreement must be finalized.' end
      ),
      'payment_requirement', payment_gate,
      'final_availability', pg_catalog.jsonb_build_object(
        'state', final_state, 'reason', final_reason
      )
    ),
    'actions', pg_catalog.jsonb_build_object(
      'canConfirmInitial', item_state = 'pass'
        and request_record.approval_status <> 'approved',
      'canApprove', all_pre_final_pass
        and request_record.approval_status <> 'approved',
      'canReverse', request_record.approval_status = 'approved'
    )
  );
end;
$$;

create or replace function public.approve_rental_request(
  target_rental_request_id uuid,
  note_value text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  request_record public.rental_requests%rowtype;
  agreement_record public.rental_agreements%rowtype;
  invoice_record public.invoices%rowtype;
  actor_id uuid;
  checklist jsonb;
  schedule_hash_value text;
  final_check_id uuid;
  approval_event_id uuid;
  evaluated_payment_policy text;
  gate_key text;
  gate_reason text;
begin
  if not private.is_staff() then
    raise exception using errcode = '42501',
      message = 'Staff authorization is required to approve a rental.';
  end if;
  if note_value is not null and length(note_value) > 2000 then
    raise exception using errcode = '22023',
      message = 'Approval notes cannot exceed 2000 characters.';
  end if;

  actor_id := private.current_staff_actor_id();
  if actor_id is null then
    raise exception using errcode = '42501',
      message = 'A valid staff actor identity is required.';
  end if;

  select * into request_record
  from public.rental_requests
  where id = target_rental_request_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Rental request not found.';
  end if;
  if request_record.approval_status = 'approved' then
    raise exception using errcode = '55000', message = 'Rental is already approved.';
  end if;
  if request_record.status in ('cancelled', 'returned', 'completed') then
    raise exception using errcode = '55000',
      message = 'The rental request lifecycle does not permit approval.';
  end if;

  select configuration_value into evaluated_payment_policy
  from private.rental_approval_configuration
  where configuration_key = 'payment_policy'
  for share;
  evaluated_payment_policy := coalesce(
    evaluated_payment_policy,
    'unconfigured'
  );

  select * into agreement_record
  from public.rental_agreements
  where id = private.canonical_rental_agreement_id(target_rental_request_id)
  for update;
  if not found then
    raise exception using errcode = '55000', message = 'Agreement must be finalized.';
  end if;

  select invoices.* into invoice_record
  from public.invoices invoices
  where invoices.rental_agreement_id = agreement_record.id
    and invoices.invoice_type = 'original_rental'
  for update;

  checklist := private.rental_approval_checklist(target_rental_request_id);
  foreach gate_key in array array[
    'item_data_complete', 'initial_availability', 'driver_license',
    'insurance', 'insurance_verification', 'card_authorization',
    'acceptance', 'agreement_final', 'payment_requirement'
  ]
  loop
    if checklist #>> array['checks', gate_key, 'state'] <> 'pass' then
      gate_reason := checklist #>> array['checks', gate_key, 'reason'];
      raise exception using errcode = '55000',
        message = coalesce(gate_reason, 'Rental approval prerequisites are incomplete.');
    end if;
  end loop;

  schedule_hash_value := private.rental_approval_schedule_hash(
    target_rental_request_id
  );
  if schedule_hash_value is null then
    raise exception using errcode = '55000',
      message = 'The finalized rental schedule cannot be identified safely.';
  end if;

  perform private.lock_rental_approval_resources(target_rental_request_id);

  insert into private.rental_approval_transition_contexts (
    transaction_id, rental_request_id, operation
  ) values (
    pg_catalog.txid_current(), target_rental_request_id, 'approve'
  );

  if private.rental_approval_has_conflict(target_rental_request_id) then
    insert into public.rental_availability_checks (
      rental_request_id, check_type, schedule_hash, result,
      checked_by, checked_at, note
    ) values (
      target_rental_request_id, 'final', schedule_hash_value, 'conflict',
      actor_id, now(), nullif(btrim(note_value), '')
    );

    delete from private.rental_approval_transition_contexts
    where transaction_id = pg_catalog.txid_current()
      and rental_request_id = target_rental_request_id
      and operation = 'approve';

    return pg_catalog.jsonb_build_object(
      'approved', false,
      'code', 'availability_conflict',
      'message', 'Equipment is no longer available for the selected dates.',
      'checklist', private.rental_approval_checklist(target_rental_request_id)
    );
  end if;

  insert into public.rental_availability_checks (
    rental_request_id, check_type, schedule_hash, result,
    checked_by, checked_at, note
  ) values (
    target_rental_request_id, 'final', schedule_hash_value, 'available',
    actor_id, now(), nullif(btrim(note_value), '')
  ) returning id into final_check_id;

  insert into public.rental_approval_events (
    rental_request_id, event_type, actor_id, occurred_at,
    note, availability_check_id, payment_policy
  ) values (
    target_rental_request_id, 'approved', actor_id, now(),
    nullif(btrim(note_value), ''), final_check_id,
    evaluated_payment_policy
  ) returning id into approval_event_id;

  update public.rental_requests
  set
    approval_status = 'approved',
    approved_by = actor_id,
    approved_at = now(),
    approval_reversed_by = null,
    approval_reversed_at = null,
    approval_reversal_note = null,
    updated_at = now()
  where id = target_rental_request_id;

  delete from private.rental_approval_transition_contexts
  where transaction_id = pg_catalog.txid_current()
    and rental_request_id = target_rental_request_id
    and operation = 'approve';

  return pg_catalog.jsonb_build_object(
    'approved', true,
    'code', 'approved',
    'message', 'Rental approved.',
    'approvalEventId', approval_event_id,
    'checklist', private.rental_approval_checklist(target_rental_request_id)
  );
end;
$$;


revoke all on function private.canonical_rental_agreement_id(uuid)
  from public, anon, authenticated;
revoke all on function private.rental_approval_checklist(uuid)
  from public, anon, authenticated;
revoke all on function public.approve_rental_request(uuid, text)
  from public, anon, authenticated;
grant execute on function public.approve_rental_request(uuid, text)
  to authenticated;

comment on function private.canonical_rental_agreement_id(uuid) is
  'Deterministically selects the canonical ready/locked Agreement, then active non-draft history, then the newest draft fallback.';
comment on index public.rental_agreements_canonical_request_key is
  'Allows retained legacy draft duplicates while enforcing one active non-draft Agreement per request.';
comment on index public.rental_agreements_release1_request_key is
  'Enforces one non-cancelled verified Release 1 Agreement snapshot per request.';
