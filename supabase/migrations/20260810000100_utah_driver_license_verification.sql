-- Release 1: manual, current-document-bound Utah driver-license verification.
-- Existing requests remain pending. No historical review evidence is inferred.

alter table public.rental_requests
  add column if not exists driver_license_verification_status text not null default 'pending',
  add column if not exists driver_license_reviewed_document_id uuid,
  add column if not exists driver_license_issuing_state text,
  add column if not exists driver_license_reviewed_by uuid,
  add column if not exists driver_license_reviewed_at timestamptz,
  add column if not exists driver_license_review_note text;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.rental_requests'::pg_catalog.regclass
      and conname = 'rental_requests_driver_license_reviewed_document_fk'
  ) then
    alter table public.rental_requests
      add constraint rental_requests_driver_license_reviewed_document_fk
      foreign key (driver_license_reviewed_document_id)
      references public.rental_documents(id)
      on update restrict on delete restrict
      not valid;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.rental_requests'::pg_catalog.regclass
      and conname = 'rental_requests_driver_license_review_state_check'
  ) then
    alter table public.rental_requests
      add constraint rental_requests_driver_license_review_state_check
      check (
        (driver_license_verification_status = 'pending'
          and driver_license_reviewed_document_id is null
          and driver_license_issuing_state is null
          and driver_license_reviewed_by is null
          and driver_license_reviewed_at is null
          and driver_license_review_note is null)
        or
        (driver_license_verification_status = 'verified'
          and driver_license_reviewed_document_id is not null
          and driver_license_issuing_state = 'UT'
          and driver_license_reviewed_by is not null
          and driver_license_reviewed_at is not null
          and (driver_license_review_note is null
            or length(driver_license_review_note) <= 2000))
        or
        (driver_license_verification_status = 'rejected'
          and driver_license_reviewed_document_id is not null
          and driver_license_issuing_state ~ '^[A-Z]{2}$'
          and driver_license_reviewed_by is not null
          and driver_license_reviewed_at is not null
          and nullif(btrim(driver_license_review_note), '') is not null
          and length(driver_license_review_note) <= 2000)
      ) not valid;
  end if;
end;
$$;

alter table public.rental_requests
  validate constraint rental_requests_driver_license_reviewed_document_fk;
alter table public.rental_requests
  validate constraint rental_requests_driver_license_review_state_check;

create table if not exists public.rental_driver_license_reviews (
  id uuid primary key default gen_random_uuid(),
  rental_request_id uuid not null,
  driver_license_document_id uuid not null,
  review_status text not null,
  issuing_state text not null,
  reviewed_by uuid not null,
  reviewed_at timestamptz not null default now(),
  review_note text,
  created_at timestamptz not null default now(),
  constraint rental_driver_license_reviews_request_fk
    foreign key (rental_request_id) references public.rental_requests(id)
    on update restrict on delete restrict,
  constraint rental_driver_license_reviews_document_fk
    foreign key (driver_license_document_id) references public.rental_documents(id)
    on update restrict on delete restrict,
  constraint rental_driver_license_reviews_status_check
    check (review_status in ('verified', 'rejected')),
  constraint rental_driver_license_reviews_state_check
    check (
      issuing_state ~ '^[A-Z]{2}$'
      and (review_status <> 'verified' or issuing_state = 'UT')
    ),
  constraint rental_driver_license_reviews_note_check
    check (
      (review_note is null or length(review_note) <= 2000)
      and (review_status <> 'rejected'
        or nullif(btrim(review_note), '') is not null)
    )
);

create index if not exists rental_driver_license_reviews_request_idx
  on public.rental_driver_license_reviews (
    rental_request_id, reviewed_at desc, id desc
  );
create index if not exists rental_driver_license_reviews_document_idx
  on public.rental_driver_license_reviews (
    driver_license_document_id, reviewed_at desc, id desc
  );

create or replace function private.protect_driver_license_review_state()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  if tg_op = 'INSERT' then
    if new.driver_license_verification_status <> 'pending'
      or new.driver_license_reviewed_document_id is not null
      or new.driver_license_issuing_state is not null
      or new.driver_license_reviewed_by is not null
      or new.driver_license_reviewed_at is not null
      or new.driver_license_review_note is not null then
      raise exception using errcode = '42501',
        message = 'Rental requests must begin with pending driver-license verification.';
    end if;
    return new;
  end if;

  if old.driver_license_verification_status is distinct from new.driver_license_verification_status
    or old.driver_license_reviewed_document_id is distinct from new.driver_license_reviewed_document_id
    or old.driver_license_issuing_state is distinct from new.driver_license_issuing_state
    or old.driver_license_reviewed_by is distinct from new.driver_license_reviewed_by
    or old.driver_license_reviewed_at is distinct from new.driver_license_reviewed_at
    or old.driver_license_review_note is distinct from new.driver_license_review_note then
    if not private.rental_document_transition_is_allowed(
      old.id,
      array['register_driver_license', 'review_driver_license']
    ) then
      raise exception using errcode = '42501',
        message = 'Driver-license verification state must be changed through the trusted review workflow.';
    end if;

    if new.driver_license_verification_status in ('verified', 'rejected') and not exists (
      select 1
      from public.rental_documents documents
      where documents.id = new.driver_license_reviewed_document_id
        and documents.rental_request_id = new.id
        and documents.document_type = 'driver_license'
        and documents.is_current
    ) then
      raise exception using errcode = '55000',
        message = 'Driver-license review evidence must reference the current driver-license document.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists rental_requests_protect_driver_license_review
  on public.rental_requests;
create trigger rental_requests_protect_driver_license_review
before insert or update on public.rental_requests
for each row execute function private.protect_driver_license_review_state();

create or replace function private.protect_driver_license_review_history()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  if tg_op = 'INSERT' then
    if not private.rental_document_transition_is_allowed(
      new.rental_request_id,
      array['review_driver_license']
    ) then
      raise exception using errcode = '42501',
        message = 'Driver-license review history must be recorded through the trusted review workflow.';
    end if;
    return new;
  end if;

  raise exception using errcode = '55000',
    message = 'Driver-license review history is append-only.';
end;
$$;

drop trigger if exists rental_driver_license_reviews_protect_history
  on public.rental_driver_license_reviews;
create trigger rental_driver_license_reviews_protect_history
before insert or update or delete on public.rental_driver_license_reviews
for each row execute function private.protect_driver_license_review_history();

create or replace function private.reset_driver_license_review_on_registration()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  if new.document_type = 'driver_license' then
    update public.rental_requests
    set
      driver_license_verification_status = 'pending',
      driver_license_reviewed_document_id = null,
      driver_license_issuing_state = null,
      driver_license_reviewed_by = null,
      driver_license_reviewed_at = null,
      driver_license_review_note = null,
      updated_at = now()
    where id = new.rental_request_id;
  end if;
  return new;
end;
$$;

drop trigger if exists rental_documents_reset_driver_license_review
  on public.rental_documents;
create trigger rental_documents_reset_driver_license_review
after insert on public.rental_documents
for each row
when (new.document_type = 'driver_license')
execute function private.reset_driver_license_review_on_registration();

create or replace function public.review_rental_driver_license(
  target_rental_request_id uuid,
  expected_driver_license_document_id uuid,
  verification_status_value text,
  issuing_state_value text,
  review_note_value text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  actor_id uuid;
  current_document_id uuid;
  normalized_state text := upper(btrim(coalesce(issuing_state_value, '')));
  normalized_note text := nullif(btrim(review_note_value), '');
  request_record public.rental_requests%rowtype;
begin
  if not private.is_staff() then
    raise exception using errcode = '42501',
      message = 'Staff authorization is required to review a driver license.';
  end if;

  if verification_status_value not in ('verified', 'rejected') then
    raise exception using errcode = '22023',
      message = 'Driver-license review status must be verified or rejected.';
  end if;
  if normalized_state !~ '^[A-Z]{2}$' then
    raise exception using errcode = '22023',
      message = 'Issuing state must be a two-letter US state code.';
  end if;
  if verification_status_value = 'verified' and normalized_state <> 'UT' then
    raise exception using errcode = '22023',
      message = 'Only a valid Utah-issued driver license may be verified.';
  end if;
  if verification_status_value = 'rejected' and normalized_note is null then
    raise exception using errcode = '22023',
      message = 'A meaningful rejection reason is required.';
  end if;
  if normalized_note is not null and length(normalized_note) > 2000 then
    raise exception using errcode = '22023',
      message = 'Driver-license review note cannot exceed 2000 characters.';
  end if;

  actor_id := private.current_staff_actor_id();
  if actor_id is null then
    raise exception using errcode = '42501',
      message = 'A valid staff actor identity is required to review a driver license.';
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
      message = 'Reverse the audited rental Approval before reviewing the driver license.';
  end if;

  if verification_status_value = 'verified' and exists (
    select 1
    from public.rental_agreements agreements
    where agreements.rental_request_id = target_rental_request_id
      and agreements.locked_at is not null
  ) then
    raise exception using errcode = '55000',
      message = 'Driver-license verification cannot be introduced after Agreement finalization; operational resolution is required.';
  end if;

  select documents.id into current_document_id
  from public.rental_documents documents
  where documents.rental_request_id = target_rental_request_id
    and documents.document_type = 'driver_license'
    and documents.is_current
  for update;
  if current_document_id is null then
    raise exception using errcode = '55000',
      message = 'A current driver-license document is required before review.';
  end if;
  if current_document_id is distinct from expected_driver_license_document_id then
    raise exception using errcode = '55000',
      message = 'The driver-license document changed after it was inspected; review the current document before recording a decision.';
  end if;

  insert into private.rental_document_transition_contexts (
    transaction_id, rental_request_id, operation, new_document_id
  ) values (
    pg_catalog.txid_current(), target_rental_request_id,
    'review_driver_license', current_document_id
  );

  insert into public.rental_driver_license_reviews (
    rental_request_id, driver_license_document_id, review_status,
    issuing_state, reviewed_by, reviewed_at, review_note
  ) values (
    target_rental_request_id, current_document_id, verification_status_value,
    normalized_state, actor_id, now(), normalized_note
  );

  update public.rental_requests
  set
    driver_license_verification_status = verification_status_value,
    driver_license_reviewed_document_id = current_document_id,
    driver_license_issuing_state = normalized_state,
    driver_license_reviewed_by = actor_id,
    driver_license_reviewed_at = now(),
    driver_license_review_note = normalized_note,
    updated_at = now()
  where id = target_rental_request_id;

  delete from private.rental_document_transition_contexts
  where transaction_id = pg_catalog.txid_current()
    and rental_request_id = target_rental_request_id
    and operation = 'review_driver_license';

  return current_document_id;
end;
$$;

create or replace function public.get_rental_document_workflow_capabilities(
  target_rental_request_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, private
as $$
declare
  request_approval_status text;
  agreement_is_finalized boolean;
  review_reason text;
begin
  if not private.is_staff() then
    raise exception using errcode = '42501',
      message = 'Staff authorization is required to inspect rental document capabilities.';
  end if;

  select requests.approval_status into request_approval_status
  from public.rental_requests requests
  where requests.id = target_rental_request_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Rental request not found.';
  end if;

  select exists (
    select 1
    from public.rental_agreements agreements
    where agreements.rental_request_id = target_rental_request_id
      and agreements.locked_at is not null
  ) into agreement_is_finalized;

  review_reason := case
    when request_approval_status = 'approved' then
      'Reverse the audited rental Approval before reviewing the driver license.'
    when agreement_is_finalized then
      'The Agreement is finalized. Verification and document changes are locked; rejection remains available.'
    else null
  end;

  return pg_catalog.jsonb_build_object(
    'agreementFinalized', agreement_is_finalized,
    'approvalStatus', request_approval_status,
    'canUploadOrReplaceDocuments', not agreement_is_finalized,
    'canReviewInsurance', not agreement_is_finalized,
    'canVerifyDriverLicense',
      not agreement_is_finalized and request_approval_status <> 'approved',
    'canRejectDriverLicense', request_approval_status <> 'approved',
    'driverLicenseReviewReason', review_reason
  );
end;
$$;

create or replace function private.assert_current_utah_driver_license(
  target_rental_request_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, private
as $$
declare
  request_record public.rental_requests%rowtype;
  current_document_id uuid;
begin
  select * into request_record
  from public.rental_requests
  where id = target_rental_request_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Rental request not found.';
  end if;

  select documents.id into current_document_id
  from public.rental_documents documents
  where documents.rental_request_id = target_rental_request_id
    and documents.document_type = 'driver_license'
    and documents.is_current;

  if current_document_id is null then
    raise exception using errcode = '55000',
      message = 'A current driver license is required.';
  end if;
  if request_record.driver_license_verification_status = 'rejected' then
    raise exception using errcode = '55000',
      message = 'The current driver license was rejected.';
  end if;
  if request_record.driver_license_reviewed_document_id is distinct from current_document_id then
    raise exception using errcode = '55000',
      message = 'Driver-license verification is pending or stale for the current document.';
  end if;
  if request_record.driver_license_verification_status <> 'verified'
    or request_record.driver_license_issuing_state <> 'UT' then
    raise exception using errcode = '55000',
      message = 'A valid Utah-issued driver license must be verified.';
  end if;
end;
$$;

-- Wrap the deployed document prerequisite function instead of copying its
-- insurance logic. Reruns retain the original exactly once.
do $$
begin
  if pg_catalog.to_regprocedure(
    'private.assert_rental_document_prerequisites_without_driver_license_verification(uuid)'
  ) is null then
    alter function private.assert_rental_document_prerequisites(uuid)
      rename to assert_rental_document_prerequisites_without_driver_license_verification;
  end if;
end;
$$;

create or replace function private.assert_rental_document_prerequisites(
  target_rental_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  perform private.assert_rental_document_prerequisites_without_driver_license_verification(
    target_rental_request_id
  );
  perform private.assert_current_utah_driver_license(target_rental_request_id);
end;
$$;

-- Wrap the reconciled canonical checklist so its established Agreement,
-- Invoice, Payment, availability, and insurance logic remains authoritative.
do $$
begin
  if pg_catalog.to_regprocedure(
    'private.rental_approval_checklist_without_driver_license_verification(uuid)'
  ) is null then
    alter function private.rental_approval_checklist(uuid)
      rename to rental_approval_checklist_without_driver_license_verification;
  end if;
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
  checklist jsonb;
  request_record public.rental_requests%rowtype;
  current_document_id uuid;
  verification_state text;
  verification_reason text;
begin
  checklist := private.rental_approval_checklist_without_driver_license_verification(
    target_rental_request_id
  );

  select * into request_record
  from public.rental_requests
  where id = target_rental_request_id;

  select documents.id into current_document_id
  from public.rental_documents documents
  where documents.rental_request_id = target_rental_request_id
    and documents.document_type = 'driver_license'
    and documents.is_current;

  if current_document_id is null then
    verification_state := 'pending';
    verification_reason := 'A current driver license is required before Utah verification.';
  elsif request_record.driver_license_verification_status = 'rejected' then
    verification_state := 'fail';
    verification_reason := 'The current driver license was rejected.';
  elsif request_record.driver_license_reviewed_document_id is distinct from current_document_id then
    verification_state := case
      when request_record.driver_license_reviewed_document_id is null then 'pending'
      else 'stale'
    end;
    verification_reason := 'The current driver license requires a new Utah verification review.';
  elsif request_record.driver_license_verification_status = 'verified'
    and request_record.driver_license_issuing_state = 'UT' then
    verification_state := 'pass';
    verification_reason := 'The current driver license is manually verified as Utah-issued.';
  else
    verification_state := 'fail';
    verification_reason := 'A valid Utah-issued driver license must be verified.';
  end if;

  checklist := pg_catalog.jsonb_set(
    checklist,
    array['checks', 'driver_license_verification'],
    pg_catalog.jsonb_build_object(
      'state', verification_state,
      'reason', verification_reason
    ),
    true
  );
  checklist := pg_catalog.jsonb_set(
    checklist,
    array['actions', 'canApprove'],
    pg_catalog.to_jsonb(
      coalesce((checklist #>> array['actions', 'canApprove'])::boolean, false)
      and verification_state = 'pass'
    ),
    true
  );
  return checklist;
end;
$$;

-- Keep the reconciled Approval transaction intact and add the Utah gate before
-- it can perform final availability work. Reruns retain the original exactly once.
do $$
begin
  if pg_catalog.to_regprocedure(
    'private.approve_rental_request_without_driver_license_verification(uuid,text)'
  ) is null then
    alter function public.approve_rental_request(uuid, text)
      rename to approve_rental_request_without_driver_license_verification;
    alter function public.approve_rental_request_without_driver_license_verification(uuid, text)
      set schema private;
  end if;
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
begin
  if not private.is_staff() then
    raise exception using errcode = '42501',
      message = 'Staff authorization is required to approve a rental.';
  end if;

  perform 1
  from public.rental_requests requests
  where requests.id = target_rental_request_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Rental request not found.';
  end if;

  -- Explicit primary enforcement before the preserved transaction can lock
  -- resources, run final availability, or create Approval evidence.
  perform private.assert_current_utah_driver_license(target_rental_request_id);

  return private.approve_rental_request_without_driver_license_verification(
    target_rental_request_id,
    note_value
  );
end;
$$;

create or replace function private.enforce_utah_driver_license_approval_gate()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  if old.approval_status is distinct from 'approved'
    and new.approval_status = 'approved' then
    perform private.assert_current_utah_driver_license(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists rental_requests_utah_driver_license_approval_gate
  on public.rental_requests;
create trigger rental_requests_utah_driver_license_approval_gate
before update of approval_status on public.rental_requests
for each row execute function private.enforce_utah_driver_license_approval_gate();

alter table public.rental_driver_license_reviews enable row level security;
drop policy if exists "staff can read driver license review history"
  on public.rental_driver_license_reviews;
create policy "staff can read driver license review history"
  on public.rental_driver_license_reviews
  for select to authenticated
  using (private.is_staff());

revoke all on public.rental_driver_license_reviews
  from public, anon, authenticated;
grant select on public.rental_driver_license_reviews to authenticated;

revoke all on function private.protect_driver_license_review_state()
  from public, anon, authenticated;
revoke all on function private.protect_driver_license_review_history()
  from public, anon, authenticated;
revoke all on function private.reset_driver_license_review_on_registration()
  from public, anon, authenticated;
revoke all on function private.assert_current_utah_driver_license(uuid)
  from public, anon, authenticated;
revoke all on function public.get_rental_document_workflow_capabilities(uuid)
  from public, anon, authenticated;
revoke all on function private.assert_rental_document_prerequisites_without_driver_license_verification(uuid)
  from public, anon, authenticated;
revoke all on function private.assert_rental_document_prerequisites(uuid)
  from public, anon, authenticated;
revoke all on function private.rental_approval_checklist_without_driver_license_verification(uuid)
  from public, anon, authenticated;
revoke all on function private.rental_approval_checklist(uuid)
  from public, anon, authenticated;
revoke all on function private.approve_rental_request_without_driver_license_verification(uuid, text)
  from public, anon, authenticated;
revoke all on function private.enforce_utah_driver_license_approval_gate()
  from public, anon, authenticated;

revoke all on function public.review_rental_driver_license(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.review_rental_driver_license(uuid, uuid, text, text, text)
  to authenticated;
grant execute on function public.get_rental_document_workflow_capabilities(uuid)
  to authenticated;
revoke all on function public.approve_rental_request(uuid, text)
  from public, anon, authenticated;
grant execute on function public.approve_rental_request(uuid, text)
  to authenticated;

comment on table public.rental_driver_license_reviews is
  'Append-only staff review history for current driver-license documents; Release 1 verification is manual and Utah-only.';
comment on function public.review_rental_driver_license(uuid, uuid, text, text, text) is
  'Records a trusted manual review only when the inspected document remains current; verified requires normalized issuing state UT.';
