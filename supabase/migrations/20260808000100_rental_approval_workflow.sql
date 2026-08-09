-- Sprint 2E: transactional, staff-only rental approval workflow.
-- Approval coordinates immutable Agreement, Invoice/Payment, and Document
-- sources without duplicating their authoritative state.

alter table public.rental_requests
  add column if not exists approval_status text not null default 'pending',
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz,
  add column if not exists approval_reversed_by uuid,
  add column if not exists approval_reversed_at timestamptz,
  add column if not exists approval_reversal_note text;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.rental_requests'::pg_catalog.regclass
      and conname = 'rental_requests_approval_status_check'
  ) then
    alter table public.rental_requests
      add constraint rental_requests_approval_status_check
      check (approval_status in ('pending', 'approved', 'reversed')) not valid;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.rental_requests'::pg_catalog.regclass
      and conname = 'rental_requests_approval_evidence_check'
  ) then
    alter table public.rental_requests
      add constraint rental_requests_approval_evidence_check
      check (
        (approval_status = 'pending'
          and approved_by is null and approved_at is null
          and approval_reversed_by is null and approval_reversed_at is null
          and approval_reversal_note is null)
        or
        (approval_status = 'approved'
          and approved_by is not null and approved_at is not null
          and approval_reversed_by is null and approval_reversed_at is null
          and approval_reversal_note is null)
        or
        (approval_status = 'reversed'
          and approved_by is not null and approved_at is not null
          and approval_reversed_by is not null and approval_reversed_at is not null)
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.rental_requests'::pg_catalog.regclass
      and conname = 'rental_requests_approval_reversal_note_length_check'
  ) then
    alter table public.rental_requests
      add constraint rental_requests_approval_reversal_note_length_check
      check (
        approval_reversal_note is null
        or length(approval_reversal_note) <= 2000
      ) not valid;
  end if;
end;
$$;

create table if not exists private.rental_approval_configuration (
  configuration_key text primary key,
  configuration_value text not null,
  updated_at timestamptz not null default now(),
  constraint rental_approval_configuration_value_check
    check (
      configuration_key <> 'payment_policy'
      or configuration_value in ('unconfigured', 'deposit_required', 'invoice_paid')
    )
);

insert into private.rental_approval_configuration (
  configuration_key, configuration_value
) values ('payment_policy', 'unconfigured')
on conflict (configuration_key) do nothing;

revoke all on private.rental_approval_configuration
  from public, anon, authenticated;

create table if not exists public.rental_availability_checks (
  id uuid primary key default gen_random_uuid(),
  rental_request_id uuid not null,
  check_type text not null,
  schedule_hash text not null,
  result text not null,
  checked_by uuid not null,
  checked_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now(),
  constraint rental_availability_checks_request_fk
    foreign key (rental_request_id) references public.rental_requests(id)
    on update restrict on delete restrict,
  constraint rental_availability_checks_type_check
    check (check_type in ('initial', 'final')),
  constraint rental_availability_checks_hash_check
    check (schedule_hash ~ '^sha256:[0-9a-f]{64}$'),
  constraint rental_availability_checks_result_check
    check (result in ('available', 'conflict')),
  constraint rental_availability_checks_note_length_check
    check (note is null or length(note) <= 2000)
);

create index if not exists rental_availability_checks_request_type_idx
  on public.rental_availability_checks (
    rental_request_id, check_type, checked_at desc, id desc
  );

create table if not exists public.rental_approval_events (
  id uuid primary key default gen_random_uuid(),
  rental_request_id uuid not null,
  event_type text not null,
  actor_id uuid not null,
  occurred_at timestamptz not null default now(),
  note text,
  availability_check_id uuid,
  created_at timestamptz not null default now(),
  constraint rental_approval_events_request_fk
    foreign key (rental_request_id) references public.rental_requests(id)
    on update restrict on delete restrict,
  constraint rental_approval_events_availability_check_fk
    foreign key (availability_check_id)
    references public.rental_availability_checks(id)
    on update restrict on delete restrict,
  constraint rental_approval_events_type_check
    check (event_type in ('approved', 'reversed')),
  constraint rental_approval_events_availability_check_check
    check (
      (event_type = 'approved' and availability_check_id is not null)
      or (event_type = 'reversed' and availability_check_id is null)
    ),
  constraint rental_approval_events_note_length_check
    check (note is null or length(note) <= 2000)
);

create index if not exists rental_approval_events_request_idx
  on public.rental_approval_events (
    rental_request_id, occurred_at desc, id desc
  );

create table if not exists private.rental_approval_transition_contexts (
  transaction_id bigint not null,
  rental_request_id uuid not null,
  operation text not null,
  primary key (transaction_id, rental_request_id, operation)
);

revoke all on private.rental_approval_transition_contexts
  from public, anon, authenticated;

create or replace function private.rental_approval_transition_is_allowed(
  target_rental_request_id uuid,
  allowed_operations text[]
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select exists (
    select 1
    from private.rental_approval_transition_contexts contexts
    where contexts.transaction_id = pg_catalog.txid_current()
      and contexts.rental_request_id = target_rental_request_id
      and contexts.operation = any(allowed_operations)
  );
$$;

create or replace function private.protect_rental_approval_state()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  if old.approval_status is distinct from new.approval_status
    or old.approved_by is distinct from new.approved_by
    or old.approved_at is distinct from new.approved_at
    or old.approval_reversed_by is distinct from new.approval_reversed_by
    or old.approval_reversed_at is distinct from new.approval_reversed_at
    or old.approval_reversal_note is distinct from new.approval_reversal_note then
    if not private.rental_approval_transition_is_allowed(
      old.id,
      array['approve', 'reverse']
    ) then
      raise exception using errcode = '42501',
        message = 'Rental approval state must be changed through the trusted Approval workflow.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists rental_requests_protect_approval_state
  on public.rental_requests;
create trigger rental_requests_protect_approval_state
before update on public.rental_requests
for each row execute function private.protect_rental_approval_state();

create or replace function private.protect_rental_availability_check_history()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  if tg_op = 'UPDATE' or tg_op = 'DELETE' then
    raise exception using errcode = '55000',
      message = 'Rental availability-check history is append-only.';
  end if;

  if not private.rental_approval_transition_is_allowed(
    new.rental_request_id,
    array['initial_check', 'approve']
  ) then
    raise exception using errcode = '42501',
      message = 'Availability checks must be recorded through the trusted Approval workflow.';
  end if;
  return new;
end;
$$;

drop trigger if exists rental_availability_checks_protect_history
  on public.rental_availability_checks;
create trigger rental_availability_checks_protect_history
before insert or update or delete on public.rental_availability_checks
for each row execute function private.protect_rental_availability_check_history();

create or replace function private.protect_rental_approval_event_history()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  if tg_op = 'UPDATE' or tg_op = 'DELETE' then
    raise exception using errcode = '55000',
      message = 'Rental approval-event history is append-only.';
  end if;

  if not private.rental_approval_transition_is_allowed(
    new.rental_request_id,
    array['approve', 'reverse']
  ) then
    raise exception using errcode = '42501',
      message = 'Approval events must be recorded through the trusted Approval workflow.';
  end if;
  return new;
end;
$$;

drop trigger if exists rental_approval_events_protect_history
  on public.rental_approval_events;
create trigger rental_approval_events_protect_history
before insert or update or delete on public.rental_approval_events
for each row execute function private.protect_rental_approval_event_history();

alter table public.rental_availability_checks enable row level security;
alter table public.rental_approval_events enable row level security;

drop policy if exists "staff can read rental availability checks"
  on public.rental_availability_checks;
create policy "staff can read rental availability checks"
  on public.rental_availability_checks
  for select to authenticated
  using (private.is_staff());

drop policy if exists "staff can read rental approval events"
  on public.rental_approval_events;
create policy "staff can read rental approval events"
  on public.rental_approval_events
  for select to authenticated
  using (private.is_staff());

revoke all on public.rental_availability_checks
  from public, anon, authenticated;
revoke all on public.rental_approval_events
  from public, anon, authenticated;
grant select on public.rental_availability_checks to authenticated;
grant select on public.rental_approval_events to authenticated;

create or replace function private.rental_approval_schedule_items(
  target_rental_request_id uuid
)
returns table (
  resource_key text,
  equipment_id text,
  serial_number text,
  start_date timestamptz,
  end_date timestamptz,
  quantity integer
)
language plpgsql
stable
security definer
set search_path = pg_catalog, private
as $$
declare
  finalized_agreement_id uuid;
begin
  select agreements.id into finalized_agreement_id
  from public.rental_agreements agreements
  where agreements.rental_request_id = target_rental_request_id
    and agreements.status = 'ready'
    and agreements.locked_at is not null;

  if finalized_agreement_id is not null then
    return query
    select
      case
        when nullif(pg_catalog.btrim(items.serial_number), '') is not null
          then 'serial:' || pg_catalog.lower(pg_catalog.btrim(items.serial_number))
        when nullif(pg_catalog.btrim(items.equipment_id), '') is not null
          then 'equipment:' || pg_catalog.btrim(items.equipment_id)
        else null
      end,
      items.equipment_id,
      nullif(pg_catalog.btrim(items.serial_number), ''),
      items.start_date,
      items.end_date,
      items.quantity
    from public.agreement_items items
    where items.rental_agreement_id = finalized_agreement_id;
    return;
  end if;

  return query
  select
    case
      when nullif(pg_catalog.btrim(items.serial_number), '') is not null
        then 'serial:' || pg_catalog.lower(pg_catalog.btrim(items.serial_number))
      when nullif(pg_catalog.btrim(items.equipment_id), '') is not null
        then 'equipment:' || pg_catalog.btrim(items.equipment_id)
      else null
    end,
    items.equipment_id,
    nullif(pg_catalog.btrim(items.serial_number), ''),
    items.start_date,
    items.end_date,
    items.quantity
  from public.rental_request_items items
  where items.rental_request_id = target_rental_request_id;
end;
$$;

create or replace function private.rental_approval_schedule_hash(
  target_rental_request_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, private
as $$
declare
  schedule_snapshot jsonb;
  item_count integer;
  invalid_count integer;
begin
  select
    count(*)::integer,
    count(*) filter (
      where items.resource_key is null
        or items.equipment_id is null
        or items.start_date is null
        or items.end_date is null
        or items.end_date < items.start_date
        or items.quantity is null
        or items.quantity <= 0
    )::integer,
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'resource_key', items.resource_key,
        'equipment_id', items.equipment_id,
        'serial_number', items.serial_number,
        'start_date', pg_catalog.to_char(
          items.start_date at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
        ),
        'end_date', pg_catalog.to_char(
          items.end_date at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
        ),
        'quantity', items.quantity
      ) order by
        items.resource_key, items.start_date, items.end_date, items.quantity
    )
  into item_count, invalid_count, schedule_snapshot
  from private.rental_approval_schedule_items(target_rental_request_id) items;

  if item_count = 0 or invalid_count > 0 then
    return null;
  end if;

  return 'sha256:' || pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(schedule_snapshot::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
end;
$$;

create or replace function private.rental_approval_item_data_complete(
  target_rental_request_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  with schedule as (
    select items.*
    from private.rental_approval_schedule_items(target_rental_request_id) items
  )
  select
    count(*) > 0
    and count(*) filter (
      where schedule.resource_key is null
        or nullif(btrim(schedule.equipment_id), '') is null
        or schedule.end_date < schedule.start_date
        or schedule.quantity <= 0
        or catalog.equipment_id is null
        or (catalog.serialized and nullif(btrim(schedule.serial_number), '') is null)
        or (catalog.serialized and schedule.quantity <> 1)
    ) = 0
  from schedule
  left join private.rental_equipment_catalog catalog
    on catalog.equipment_id = schedule.equipment_id;
$$;

create or replace function private.lock_rental_approval_resources(
  target_rental_request_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog, private
as $$
declare
  resource record;
begin
  for resource in
    select distinct items.resource_key
    from private.rental_approval_schedule_items(target_rental_request_id) items
    where items.resource_key is not null
    order by items.resource_key
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(resource.resource_key, 0)
    );
  end loop;
end;
$$;

create or replace function private.rental_approval_has_conflict(
  target_rental_request_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  with current_items as (
    select *
    from private.rental_approval_schedule_items(target_rental_request_id)
  ),
  blocking_requests as (
    select requests.id
    from public.rental_requests requests
    where requests.id <> target_rental_request_id
      and requests.status <> 'cancelled'
      and requests.approval_status <> 'reversed'
      and (
        requests.approval_status = 'approved'
        or (
          requests.approval_status = 'pending'
          and not exists (
            select 1 from public.rental_approval_events events
            where events.rental_request_id = requests.id
          )
          and requests.status in (
            'confirmed', 'preparing_equipment', 'scheduled_delivery',
            'pickup_scheduled', 'active_rental', 'return_due'
          )
        )
      )
  ),
  blocking_items as (
    select
      case
        when nullif(btrim(items.serial_number), '') is not null
          then 'serial:' || lower(btrim(items.serial_number))
        when nullif(btrim(items.equipment_id), '') is not null
          then 'equipment:' || btrim(items.equipment_id)
        else null
      end as resource_key,
      items.start_date,
      items.end_date
    from blocking_requests requests
    join public.rental_agreements agreements
      on agreements.rental_request_id = requests.id
     and agreements.status <> 'cancelled'
    join public.agreement_items items
      on items.rental_agreement_id = agreements.id
  )
  select exists (
    select 1
    from current_items current_item
    join blocking_items blocking_item
      on blocking_item.resource_key = current_item.resource_key
     and current_item.start_date <= blocking_item.end_date
     and blocking_item.start_date <= current_item.end_date
  );
$$;

create or replace function private.rental_approval_payment_gate(
  target_rental_request_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, private
as $$
declare
  policy_value text;
  invoice_record public.invoices%rowtype;
begin
  select configuration_value into policy_value
  from private.rental_approval_configuration
  where configuration_key = 'payment_policy';

  policy_value := coalesce(policy_value, 'unconfigured');
  if policy_value = 'unconfigured' then
    return pg_catalog.jsonb_build_object(
      'state', 'configuration_required',
      'reason', 'Payment requirement has not been configured.',
      'policy', policy_value
    );
  end if;

  select invoices.* into invoice_record
  from public.invoices invoices
  join public.rental_agreements agreements
    on agreements.id = invoices.rental_agreement_id
  where agreements.rental_request_id = target_rental_request_id
    and invoices.invoice_type = 'original_rental';

  if not found then
    return pg_catalog.jsonb_build_object(
      'state', 'fail',
      'reason', 'An original Invoice is required.',
      'policy', policy_value
    );
  end if;

  if invoice_record.status in ('cancelled', 'void') then
    return pg_catalog.jsonb_build_object(
      'state', 'fail',
      'reason', 'The original Invoice is cancelled or void.',
      'policy', policy_value
    );
  end if;

  if invoice_record.status = 'draft' or invoice_record.issued_at is null then
    return pg_catalog.jsonb_build_object(
      'state', 'fail',
      'reason', 'The original Invoice must be issued.',
      'policy', policy_value
    );
  end if;

  if invoice_record.amount_paid < 0
    or invoice_record.balance_due <> pg_catalog.round(
      invoice_record.total_amount - invoice_record.amount_paid,
      2
    )
    or invoice_record.amount_paid > invoice_record.total_amount then
    return pg_catalog.jsonb_build_object(
      'state', 'fail',
      'reason', 'Invoice payment totals are inconsistent.',
      'policy', policy_value
    );
  end if;

  if policy_value = 'deposit_required' then
    if invoice_record.amount_paid >= invoice_record.deposit_amount then
      return pg_catalog.jsonb_build_object(
        'state', 'pass',
        'reason', 'The configured deposit requirement is satisfied.',
        'policy', policy_value
      );
    end if;
    return pg_catalog.jsonb_build_object(
      'state', 'fail',
      'reason', 'The required deposit has not been paid.',
      'policy', policy_value
    );
  end if;

  if policy_value = 'invoice_paid'
    and invoice_record.status = 'paid'
    and invoice_record.payment_status = 'paid'
    and invoice_record.balance_due = 0
    and invoice_record.amount_paid = invoice_record.total_amount then
    return pg_catalog.jsonb_build_object(
      'state', 'pass',
      'reason', 'The original Invoice is paid in full.',
      'policy', policy_value
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'state', 'fail',
    'reason', 'The original Invoice has an outstanding balance.',
    'policy', policy_value
  );
end;
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
  where rental_request_id = target_rental_request_id;

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

create or replace function public.get_rental_approval_checklist(
  target_rental_request_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, private
as $$
begin
  if not private.is_staff() then
    raise exception using errcode = '42501',
      message = 'Staff authorization is required to view Approval status.';
  end if;
  return private.rental_approval_checklist(target_rental_request_id);
end;
$$;

create or replace function public.confirm_rental_request_initial_availability(
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
  actor_id uuid;
  schedule_hash_value text;
  availability_result text;
begin
  if not private.is_staff() then
    raise exception using errcode = '42501',
      message = 'Staff authorization is required to confirm availability.';
  end if;
  if note_value is not null and length(note_value) > 2000 then
    raise exception using errcode = '22023',
      message = 'Availability notes cannot exceed 2000 characters.';
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
    raise exception using errcode = '55000',
      message = 'An approved rental cannot receive a new initial availability check.';
  end if;
  if request_record.status in ('cancelled', 'returned', 'completed') then
    raise exception using errcode = '55000',
      message = 'The rental request lifecycle does not permit availability confirmation.';
  end if;

  schedule_hash_value := private.rental_approval_schedule_hash(
    target_rental_request_id
  );
  if schedule_hash_value is null
    or not private.rental_approval_item_data_complete(target_rental_request_id) then
    raise exception using errcode = '55000',
      message = 'Complete authoritative item data is required before availability confirmation.';
  end if;

  perform private.lock_rental_approval_resources(target_rental_request_id);
  availability_result := case
    when private.rental_approval_has_conflict(target_rental_request_id)
      then 'conflict'
    else 'available'
  end;

  insert into private.rental_approval_transition_contexts (
    transaction_id, rental_request_id, operation
  ) values (
    pg_catalog.txid_current(), target_rental_request_id, 'initial_check'
  );

  insert into public.rental_availability_checks (
    rental_request_id, check_type, schedule_hash, result,
    checked_by, checked_at, note
  ) values (
    target_rental_request_id, 'initial', schedule_hash_value,
    availability_result, actor_id, now(), nullif(btrim(note_value), '')
  );

  update public.rental_requests
  set
    availability_status = availability_result,
    availability_notes = case
      when availability_result = 'available'
        then 'Initial availability confirmed for the current item schedule.'
      else 'Initial availability check found a blocking rental conflict.'
    end,
    updated_at = now()
  where id = target_rental_request_id;

  delete from private.rental_approval_transition_contexts
  where transaction_id = pg_catalog.txid_current()
    and rental_request_id = target_rental_request_id
    and operation = 'initial_check';

  return pg_catalog.jsonb_build_object(
    'confirmed', availability_result = 'available',
    'code', case when availability_result = 'available'
      then 'available' else 'availability_conflict' end,
    'message', case when availability_result = 'available'
      then 'Initial availability confirmed.'
      else 'Equipment conflicts with a committed rental.' end,
    'checklist', private.rental_approval_checklist(target_rental_request_id)
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

  select * into agreement_record
  from public.rental_agreements
  where rental_request_id = target_rental_request_id
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
    note, availability_check_id
  ) values (
    target_rental_request_id, 'approved', actor_id, now(),
    nullif(btrim(note_value), ''), final_check_id
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

create or replace function public.reverse_rental_approval(
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
  actor_id uuid;
  reversal_event_id uuid;
begin
  if not private.is_staff() then
    raise exception using errcode = '42501',
      message = 'Staff authorization is required to reverse Approval.';
  end if;
  if note_value is not null and length(note_value) > 2000 then
    raise exception using errcode = '22023',
      message = 'Reversal notes cannot exceed 2000 characters.';
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
  if request_record.approval_status <> 'approved' then
    raise exception using errcode = '55000',
      message = 'Only a currently approved rental can be reversed.';
  end if;

  insert into private.rental_approval_transition_contexts (
    transaction_id, rental_request_id, operation
  ) values (
    pg_catalog.txid_current(), target_rental_request_id, 'reverse'
  );

  insert into public.rental_approval_events (
    rental_request_id, event_type, actor_id, occurred_at, note
  ) values (
    target_rental_request_id, 'reversed', actor_id, now(),
    nullif(btrim(note_value), '')
  ) returning id into reversal_event_id;

  update public.rental_requests
  set
    approval_status = 'reversed',
    approval_reversed_by = actor_id,
    approval_reversed_at = now(),
    approval_reversal_note = nullif(btrim(note_value), ''),
    updated_at = now()
  where id = target_rental_request_id;

  delete from private.rental_approval_transition_contexts
  where transaction_id = pg_catalog.txid_current()
    and rental_request_id = target_rental_request_id
    and operation = 'reverse';

  return pg_catalog.jsonb_build_object(
    'reversed', true,
    'code', 'reversed',
    'message', 'Rental Approval reversed.',
    'approvalEventId', reversal_event_id,
    'checklist', private.rental_approval_checklist(target_rental_request_id)
  );
end;
$$;

revoke all on function private.rental_approval_transition_is_allowed(uuid, text[])
  from public, anon, authenticated;
revoke all on function private.protect_rental_approval_state()
  from public, anon, authenticated;
revoke all on function private.protect_rental_availability_check_history()
  from public, anon, authenticated;
revoke all on function private.protect_rental_approval_event_history()
  from public, anon, authenticated;
revoke all on function private.rental_approval_schedule_items(uuid)
  from public, anon, authenticated;
revoke all on function private.rental_approval_schedule_hash(uuid)
  from public, anon, authenticated;
revoke all on function private.rental_approval_item_data_complete(uuid)
  from public, anon, authenticated;
revoke all on function private.lock_rental_approval_resources(uuid)
  from public, anon, authenticated;
revoke all on function private.rental_approval_has_conflict(uuid)
  from public, anon, authenticated;
revoke all on function private.rental_approval_payment_gate(uuid)
  from public, anon, authenticated;
revoke all on function private.rental_approval_checklist(uuid)
  from public, anon, authenticated;

revoke all on function public.get_rental_approval_checklist(uuid)
  from public, anon, authenticated;
grant execute on function public.get_rental_approval_checklist(uuid)
  to authenticated;
revoke all on function public.confirm_rental_request_initial_availability(uuid, text)
  from public, anon, authenticated;
grant execute on function public.confirm_rental_request_initial_availability(uuid, text)
  to authenticated;
revoke all on function public.approve_rental_request(uuid, text)
  from public, anon, authenticated;
grant execute on function public.approve_rental_request(uuid, text)
  to authenticated;
revoke all on function public.reverse_rental_approval(uuid, text)
  from public, anon, authenticated;
grant execute on function public.reverse_rental_approval(uuid, text)
  to authenticated;

alter table public.rental_requests
  validate constraint rental_requests_approval_status_check;
alter table public.rental_requests
  validate constraint rental_requests_approval_evidence_check;
alter table public.rental_requests
  validate constraint rental_requests_approval_reversal_note_length_check;

comment on table public.rental_availability_checks is
  'Append-only initial and final availability evidence bound to a deterministic authoritative schedule hash.';
comment on table public.rental_approval_events is
  'Append-only rental Approval and reversal audit history.';
comment on function public.approve_rental_request(uuid, text) is
  'Revalidates every trusted prerequisite and final availability under deterministic transaction-scoped resource locks before Approval.';
