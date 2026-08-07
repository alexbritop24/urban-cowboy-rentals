-- Sprint 2D: private, staff-only driver-license and insurance documents.
-- File bytes remain in the private rental-documents Storage bucket. PostgreSQL
-- stores immutable metadata and owns all replacement and insurance-review state.

alter table public.rental_requests
  add column if not exists insurance_reviewed_document_id uuid,
  add column if not exists insurance_reviewed_by uuid,
  add column if not exists insurance_reviewed_at timestamptz,
  add column if not exists insurance_review_note text;

create table if not exists public.rental_documents (
  id uuid primary key default gen_random_uuid(),
  rental_request_id uuid not null,
  document_type text not null,
  storage_bucket text not null,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null,
  uploaded_by uuid not null,
  uploaded_at timestamptz not null default now(),
  is_current boolean not null default true,
  replaces_document_id uuid,
  replaced_by_document_id uuid,
  replaced_at timestamptz,
  replaced_by uuid,
  created_at timestamptz not null default now(),
  constraint rental_documents_request_fk
    foreign key (rental_request_id) references public.rental_requests(id)
    on delete restrict,
  constraint rental_documents_type_check
    check (document_type in ('driver_license', 'insurance')),
  constraint rental_documents_bucket_check
    check (storage_bucket = 'rental-documents'),
  constraint rental_documents_mime_check
    check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  constraint rental_documents_filename_check
    check (
      length(original_filename) between 1 and 255
      and original_filename !~ '[[:cntrl:]]'
    ),
  constraint rental_documents_size_check
    check (size_bytes between 1 and 10485760),
  constraint rental_documents_replacement_state_check
    check (
      (is_current and replaced_at is null and replaced_by is null
        and replaced_by_document_id is null)
      or
      (not is_current and replaced_at is not null and replaced_by is not null
        and replaced_by_document_id is not null)
    ),
  constraint rental_documents_replaces_fk
    foreign key (replaces_document_id) references public.rental_documents(id)
    on delete restrict deferrable initially deferred,
  constraint rental_documents_replaced_by_document_fk
    foreign key (replaced_by_document_id) references public.rental_documents(id)
    on delete restrict deferrable initially deferred,
  constraint rental_documents_path_unique unique (storage_bucket, storage_path)
);

create unique index if not exists rental_documents_one_current_per_type
  on public.rental_documents (rental_request_id, document_type)
  where is_current;

create unique index if not exists rental_documents_single_replacement_target
  on public.rental_documents (replaces_document_id)
  where replaces_document_id is not null;

create index if not exists rental_documents_request_history_idx
  on public.rental_documents (rental_request_id, document_type, uploaded_at desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.rental_requests'::regclass
      and conname = 'rental_requests_insurance_reviewed_document_fk'
  ) then
    alter table public.rental_requests
      add constraint rental_requests_insurance_reviewed_document_fk
      foreign key (insurance_reviewed_document_id)
      references public.rental_documents(id)
      on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.rental_requests'::regclass
      and conname = 'rental_requests_insurance_review_note_length_check'
  ) then
    alter table public.rental_requests
      add constraint rental_requests_insurance_review_note_length_check
      check (insurance_review_note is null or length(insurance_review_note) <= 2000)
      not valid;
  end if;
end;
$$;

create table if not exists private.rental_document_transition_contexts (
  transaction_id bigint not null,
  rental_request_id uuid not null,
  operation text not null,
  new_document_id uuid,
  primary key (transaction_id, rental_request_id, operation)
);

revoke all on private.rental_document_transition_contexts
  from public, anon, authenticated;

create or replace function private.rental_document_transition_is_allowed(
  target_request_id uuid,
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
    from private.rental_document_transition_contexts contexts
    where contexts.transaction_id = txid_current()
      and contexts.rental_request_id = target_request_id
      and contexts.operation = any(allowed_operations)
  );
$$;

create or replace function private.protect_rental_document_metadata()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000',
      message = 'Rental document metadata cannot be hard-deleted.';
  end if;

  if tg_op = 'INSERT' then
    if not private.rental_document_transition_is_allowed(
      new.rental_request_id,
      array['register_driver_license', 'register_insurance']
    ) then
      raise exception using errcode = '42501',
        message = 'Rental document metadata must be registered through the trusted workflow.';
    end if;
    return new;
  end if;

  if not private.rental_document_transition_is_allowed(
    old.rental_request_id,
    array['register_driver_license', 'register_insurance']
  ) then
    raise exception using errcode = '42501',
      message = 'Rental document metadata is immutable outside the replacement workflow.';
  end if;

  if old.id is distinct from new.id
    or old.rental_request_id is distinct from new.rental_request_id
    or old.document_type is distinct from new.document_type
    or old.storage_bucket is distinct from new.storage_bucket
    or old.storage_path is distinct from new.storage_path
    or old.original_filename is distinct from new.original_filename
    or old.mime_type is distinct from new.mime_type
    or old.size_bytes is distinct from new.size_bytes
    or old.uploaded_by is distinct from new.uploaded_by
    or old.uploaded_at is distinct from new.uploaded_at
    or old.replaces_document_id is distinct from new.replaces_document_id
    or old.created_at is distinct from new.created_at
    or old.is_current is not true
    or new.is_current is not false
    or new.replaced_at is null
    or new.replaced_by is null
    or new.replaced_by_document_id is null then
    raise exception using errcode = '55000',
      message = 'Only the current-to-replaced metadata transition is permitted.';
  end if;

  return new;
end;
$$;

drop trigger if exists rental_documents_protect_metadata
  on public.rental_documents;
create trigger rental_documents_protect_metadata
before insert or update or delete on public.rental_documents
for each row execute function private.protect_rental_document_metadata();

create or replace function private.protect_insurance_review_state()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  if old.insurance_verification_status is distinct from new.insurance_verification_status
    or old.insurance_reviewed_document_id is distinct from new.insurance_reviewed_document_id
    or old.insurance_reviewed_by is distinct from new.insurance_reviewed_by
    or old.insurance_reviewed_at is distinct from new.insurance_reviewed_at
    or old.insurance_review_note is distinct from new.insurance_review_note then
    if not private.rental_document_transition_is_allowed(
      old.id,
      array['register_insurance', 'review_insurance']
    ) then
      raise exception using errcode = '42501',
        message = 'Insurance verification state must be changed through the trusted document workflow.';
    end if;

    if new.insurance_verification_status = 'pending' and (
      new.insurance_reviewed_document_id is not null
      or new.insurance_reviewed_by is not null
      or new.insurance_reviewed_at is not null
      or new.insurance_review_note is not null
    ) then
      raise exception using errcode = '55000',
        message = 'Pending insurance cannot retain prior review evidence.';
    end if;

    if new.insurance_verification_status in ('verified', 'rejected') and (
      new.insurance_reviewed_document_id is null
      or new.insurance_reviewed_by is null
      or new.insurance_reviewed_at is null
      or not exists (
        select 1 from public.rental_documents documents
        where documents.id = new.insurance_reviewed_document_id
          and documents.rental_request_id = new.id
          and documents.document_type = 'insurance'
          and documents.is_current
      )
    ) then
      raise exception using errcode = '55000',
        message = 'Insurance review evidence must reference the current insurance document.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists rental_requests_protect_insurance_review
  on public.rental_requests;
create trigger rental_requests_protect_insurance_review
before update on public.rental_requests
for each row execute function private.protect_insurance_review_state();

alter table public.rental_documents enable row level security;

drop policy if exists "staff can read rental document metadata"
  on public.rental_documents;
create policy "staff can read rental document metadata"
  on public.rental_documents
  for select to authenticated
  using (private.is_staff());

revoke all on public.rental_documents from public, anon, authenticated;
grant select on public.rental_documents to authenticated;

create or replace function public.register_rental_document(
  target_rental_request_id uuid,
  document_type_value text,
  storage_bucket_value text,
  storage_path_value text,
  original_filename_value text,
  mime_type_value text,
  size_bytes_value bigint
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  actor_id uuid;
  new_document_id uuid := gen_random_uuid();
  prior_document public.rental_documents%rowtype;
  object_metadata jsonb;
  transition_operation text;
begin
  if not private.is_staff() then
    raise exception using errcode = '42501',
      message = 'Staff authorization is required to upload rental documents.';
  end if;

  actor_id := private.current_staff_actor_id();
  if actor_id is null then
    raise exception using errcode = '42501',
      message = 'A valid staff actor identity is required to upload rental documents.';
  end if;

  if document_type_value not in ('driver_license', 'insurance') then
    raise exception using errcode = '22023', message = 'Unsupported rental document type.';
  end if;

  if storage_bucket_value <> 'rental-documents'
    or storage_path_value !~ (
      '^' || target_rental_request_id::text || '/' || document_type_value ||
      '/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|jpeg|png)$'
    ) then
    raise exception using errcode = '22023', message = 'Invalid rental document storage path.';
  end if;

  if nullif(btrim(original_filename_value), '') is null
    or length(btrim(original_filename_value)) > 255
    or btrim(original_filename_value) ~ '[[:cntrl:]]'
    or position('/' in original_filename_value) > 0
    or position(chr(92) in original_filename_value) > 0 then
    raise exception using errcode = '22023', message = 'Invalid rental document filename.';
  end if;

  if mime_type_value not in ('application/pdf', 'image/jpeg', 'image/png')
    or size_bytes_value < 1
    or size_bytes_value > 10485760 then
    raise exception using errcode = '22023', message = 'Invalid rental document file metadata.';
  end if;

  if not (
    mime_type_value = 'application/pdf'
      and lower(original_filename_value) ~ '\.pdf$'
      and storage_path_value ~ '\.pdf$'
    or mime_type_value = 'image/jpeg'
      and lower(original_filename_value) ~ '\.(jpg|jpeg)$'
      and storage_path_value ~ '\.(jpg|jpeg)$'
    or mime_type_value = 'image/png'
      and lower(original_filename_value) ~ '\.png$'
      and storage_path_value ~ '\.png$'
  ) then
    raise exception using errcode = '22023',
      message = 'Rental document filename, object extension, and MIME type must match.';
  end if;

  perform 1 from public.rental_requests
  where id = target_rental_request_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Rental request not found.';
  end if;

  if exists (
    select 1 from public.rental_agreements
    where rental_request_id = target_rental_request_id
      and locked_at is not null
  ) then
    raise exception using errcode = '55000',
      message = 'Documents cannot be changed after Agreement finalization.';
  end if;

  select objects.metadata into object_metadata
  from storage.objects objects
  where objects.bucket_id = storage_bucket_value
    and objects.name = storage_path_value;

  if not found then
    raise exception using errcode = '55000',
      message = 'The rental document object was not stored.';
  end if;

  if coalesce((object_metadata ->> 'size')::bigint, -1) <> size_bytes_value
    or coalesce(object_metadata ->> 'mimetype', '') <> mime_type_value then
    raise exception using errcode = '22023',
      message = 'Stored object metadata does not match the validated upload.';
  end if;

  select * into prior_document
  from public.rental_documents
  where rental_request_id = target_rental_request_id
    and document_type = document_type_value
    and is_current
  for update;

  transition_operation := case document_type_value
    when 'insurance' then 'register_insurance'
    else 'register_driver_license'
  end;

  insert into private.rental_document_transition_contexts (
    transaction_id, rental_request_id, operation, new_document_id
  ) values (
    txid_current(), target_rental_request_id, transition_operation, new_document_id
  );

  if prior_document.id is not null then
    update public.rental_documents
    set
      is_current = false,
      replaced_at = now(),
      replaced_by = actor_id,
      replaced_by_document_id = new_document_id
    where id = prior_document.id;
  end if;

  insert into public.rental_documents (
    id,
    rental_request_id,
    document_type,
    storage_bucket,
    storage_path,
    original_filename,
    mime_type,
    size_bytes,
    uploaded_by,
    replaces_document_id
  ) values (
    new_document_id,
    target_rental_request_id,
    document_type_value,
    storage_bucket_value,
    storage_path_value,
    btrim(original_filename_value),
    mime_type_value,
    size_bytes_value,
    actor_id,
    prior_document.id
  );

  if document_type_value = 'insurance' then
    update public.rental_requests
    set
      insurance_verification_status = 'pending',
      insurance_reviewed_document_id = null,
      insurance_reviewed_by = null,
      insurance_reviewed_at = null,
      insurance_review_note = null,
      updated_at = now()
    where id = target_rental_request_id;
  end if;

  delete from private.rental_document_transition_contexts
  where transaction_id = txid_current()
    and rental_request_id = target_rental_request_id
    and operation = transition_operation;

  return new_document_id;
end;
$$;

create or replace function public.review_rental_insurance(
  target_rental_request_id uuid,
  verification_status_value text,
  review_note_value text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  actor_id uuid;
  insurance_document_id uuid;
begin
  if not private.is_staff() then
    raise exception using errcode = '42501',
      message = 'Staff authorization is required to review insurance.';
  end if;

  if verification_status_value not in ('verified', 'rejected') then
    raise exception using errcode = '22023',
      message = 'Insurance review status must be verified or rejected.';
  end if;

  if review_note_value is not null and length(review_note_value) > 2000 then
    raise exception using errcode = '22023',
      message = 'Insurance review note cannot exceed 2000 characters.';
  end if;

  perform 1 from public.rental_requests
  where id = target_rental_request_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Rental request not found.';
  end if;

  if exists (
    select 1 from public.rental_agreements
    where rental_request_id = target_rental_request_id
      and locked_at is not null
  ) then
    raise exception using errcode = '55000',
      message = 'Insurance cannot be reviewed after Agreement finalization.';
  end if;

  select id into insurance_document_id
  from public.rental_documents
  where rental_request_id = target_rental_request_id
    and document_type = 'insurance'
    and is_current
  for update;

  if insurance_document_id is null then
    raise exception using errcode = '55000',
      message = 'A current insurance document is required before review.';
  end if;

  actor_id := private.current_staff_actor_id();
  if actor_id is null then
    raise exception using errcode = '42501',
      message = 'A valid staff actor identity is required to review insurance.';
  end if;
  insert into private.rental_document_transition_contexts (
    transaction_id, rental_request_id, operation, new_document_id
  ) values (
    txid_current(), target_rental_request_id, 'review_insurance', insurance_document_id
  );

  update public.rental_requests
  set
    insurance_verification_status = verification_status_value,
    insurance_reviewed_document_id = insurance_document_id,
    insurance_reviewed_by = actor_id,
    insurance_reviewed_at = now(),
    insurance_review_note = nullif(btrim(review_note_value), ''),
    updated_at = now()
  where id = target_rental_request_id;

  delete from private.rental_document_transition_contexts
  where transaction_id = txid_current()
    and rental_request_id = target_rental_request_id
    and operation = 'review_insurance';

  return insurance_document_id;
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
declare
  current_insurance_id uuid;
  request_record public.rental_requests%rowtype;
begin
  select * into request_record
  from public.rental_requests
  where id = target_rental_request_id;

  if not exists (
    select 1 from public.rental_documents
    where rental_request_id = target_rental_request_id
      and document_type = 'driver_license'
      and is_current
  ) then
    raise exception using errcode = '55000',
      message = 'Driver license is required before Agreement finalization.';
  end if;

  select id into current_insurance_id
  from public.rental_documents
  where rental_request_id = target_rental_request_id
    and document_type = 'insurance'
    and is_current;

  if current_insurance_id is null then
    raise exception using errcode = '55000',
      message = 'Insurance document is required before Agreement finalization.';
  end if;

  if request_record.insurance_verification_status <> 'verified'
    or request_record.insurance_reviewed_document_id is distinct from current_insurance_id then
    raise exception using errcode = '55000',
      message = 'Insurance must be verified before Agreement finalization.';
  end if;
end;
$$;

-- Preserve the previously reviewed finalization transaction as an inaccessible
-- internal function, then add the document gate ahead of it without modifying a
-- merged migration.
do $$
begin
  if to_regprocedure('private.finalize_rental_agreement_transaction(uuid)') is null then
    alter function public.finalize_rental_agreement(uuid)
      rename to finalize_rental_agreement_transaction;
    alter function public.finalize_rental_agreement_transaction(uuid)
      set schema private;
  end if;
end;
$$;

create or replace function public.finalize_rental_agreement(
  target_agreement_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  target_request_id uuid;
begin
  if not private.is_staff() then
    raise exception using errcode = '42501',
      message = 'Staff authorization is required to finalize an Agreement.';
  end if;

  select rental_request_id into target_request_id
  from public.rental_agreements
  where id = target_agreement_id
  for update;

  if target_request_id is null then
    raise exception using errcode = 'P0002', message = 'Rental Agreement not found.';
  end if;

  perform 1 from public.rental_requests
  where id = target_request_id
  for update;

  perform private.assert_rental_document_prerequisites(target_request_id);
  return private.finalize_rental_agreement_transaction(target_agreement_id);
end;
$$;

create or replace function private.enforce_rental_document_finalization_gate()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  if old.status is distinct from 'ready' and new.status = 'ready' then
    perform private.assert_rental_document_prerequisites(new.rental_request_id);
  end if;
  return new;
end;
$$;

drop trigger if exists rental_agreements_document_finalization_gate
  on public.rental_agreements;
create trigger rental_agreements_document_finalization_gate
before update of status on public.rental_agreements
for each row execute function private.enforce_rental_document_finalization_gate();

revoke all on function private.rental_document_transition_is_allowed(uuid, text[])
  from public, anon, authenticated;
revoke all on function private.protect_rental_document_metadata()
  from public, anon, authenticated;
revoke all on function private.protect_insurance_review_state()
  from public, anon, authenticated;
revoke all on function private.assert_rental_document_prerequisites(uuid)
  from public, anon, authenticated;
revoke all on function private.finalize_rental_agreement_transaction(uuid)
  from public, anon, authenticated;
revoke all on function private.enforce_rental_document_finalization_gate()
  from public, anon, authenticated;

revoke all on function public.register_rental_document(uuid, text, text, text, text, text, bigint)
  from public, anon, authenticated;
grant execute on function public.register_rental_document(uuid, text, text, text, text, text, bigint)
  to authenticated;

revoke all on function public.review_rental_insurance(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.review_rental_insurance(uuid, text, text)
  to authenticated;

revoke all on function public.finalize_rental_agreement(uuid)
  from public, anon, authenticated;
grant execute on function public.finalize_rental_agreement(uuid)
  to authenticated;

-- Supabase Storage is managed outside public. The clean local test harness
-- creates the equivalent schema before this migration is applied.
insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) values (
  'rental-documents',
  'rental-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table storage.objects enable row level security;

drop policy if exists "staff can read private rental documents"
  on storage.objects;
create policy "staff can read private rental documents"
  on storage.objects
  for select to authenticated
  using (bucket_id = 'rental-documents' and private.is_staff());

create or replace function private.protect_registered_rental_document_object()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  if old.bucket_id = 'rental-documents'
    and exists (
      select 1 from public.rental_documents documents
      where documents.storage_bucket = old.bucket_id
        and documents.storage_path = old.name
    ) then
    raise exception using errcode = '55000',
      message = 'Registered rental document objects cannot be deleted or moved.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists rental_document_objects_prevent_orphan
  on storage.objects;
create trigger rental_document_objects_prevent_orphan
before delete or update of bucket_id, name on storage.objects
for each row execute function private.protect_registered_rental_document_object();

revoke all on function private.protect_registered_rental_document_object()
  from public, anon, authenticated;

comment on table public.rental_documents is
  'Immutable metadata and replacement lineage for Release 1 driver-license and insurance documents; file bytes stay in private Storage.';
comment on column public.rental_documents.storage_path is
  'Opaque staff-only Storage path. Never expose it in normal UI or persist a signed URL.';
comment on function public.register_rental_document(uuid, text, text, text, text, text, bigint) is
  'Registers a validated stored object and atomically replaces the current document; insurance registration resets verification.';
comment on function public.review_rental_insurance(uuid, text, text) is
  'Records a trusted staff review against the current insurance document.';
