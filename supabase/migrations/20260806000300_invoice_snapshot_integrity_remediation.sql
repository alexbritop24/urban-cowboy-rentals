-- Sprint 2B-C.1: close privileged Invoice item append and lifecycle timestamp gaps.

create table if not exists private.invoice_creation_contexts (
  transaction_id bigint primary key,
  rental_agreement_id uuid not null
);

revoke all on private.invoice_creation_contexts from public, anon, authenticated;

do $$
begin
  if pg_catalog.to_regprocedure(
    'private.create_invoice_for_agreement_transaction(uuid)'
  ) is null then
    alter function public.create_invoice_for_agreement(uuid)
      rename to create_invoice_for_agreement_transaction;
    alter function public.create_invoice_for_agreement_transaction(uuid)
      set schema private;
  end if;
end;
$$;

revoke all on function private.create_invoice_for_agreement_transaction(uuid)
  from public, anon, authenticated;

create or replace function public.create_invoice_for_agreement(
  target_rental_agreement_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  new_invoice_id uuid;
begin
  insert into private.invoice_creation_contexts (
    transaction_id,
    rental_agreement_id
  ) values (
    pg_catalog.txid_current(),
    target_rental_agreement_id
  )
  on conflict (transaction_id) do update
    set rental_agreement_id = excluded.rental_agreement_id;

  new_invoice_id := private.create_invoice_for_agreement_transaction(
    target_rental_agreement_id
  );

  delete from private.invoice_creation_contexts
  where transaction_id = pg_catalog.txid_current();

  return new_invoice_id;
end;
$$;

create or replace function private.prevent_non_draft_invoice_item_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  parent_status text;
begin
  select invoices.status
  into parent_status
  from public.invoices invoices
  where invoices.id = new.invoice_id
  for update;

  if not found then
    raise exception using errcode = '23503',
      message = 'The parent Invoice does not exist.';
  end if;

  if parent_status <> 'draft' then
    raise exception using errcode = '55000',
      message = 'Invoice items cannot be added after Invoice issuance or closure.';
  end if;

  if not exists (
    select 1
    from private.invoice_creation_contexts creation_context
    join public.invoices invoices
      on invoices.id = new.invoice_id
    where creation_context.transaction_id = pg_catalog.txid_current()
      and creation_context.rental_agreement_id = invoices.rental_agreement_id
  ) then
    raise exception using errcode = '42501',
      message = 'Invoice items may only be added by the transactional Invoice creation workflow.';
  end if;

  return new;
end;
$$;

create or replace function private.protect_invoice_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000',
      message = 'Invoices are financial records and cannot be hard-deleted.';
  end if;

  if old.rental_agreement_id is distinct from new.rental_agreement_id
    or old.rental_request_id is distinct from new.rental_request_id
    or old.invoice_number is distinct from new.invoice_number
    or old.invoice_type is distinct from new.invoice_type
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
    or old.source_agreement_snapshot_hash is distinct from new.source_agreement_snapshot_hash
    or old.currency is distinct from new.currency
    or old.payment_terms is distinct from new.payment_terms
    or old.subtotal is distinct from new.subtotal
    or old.deposit_amount is distinct from new.deposit_amount
    or old.delivery_fee is distinct from new.delivery_fee
    or old.tax_amount is distinct from new.tax_amount
    or old.other_charges_amount is distinct from new.other_charges_amount
    or old.total_amount is distinct from new.total_amount
    or old.created_by is distinct from new.created_by
    or old.created_at is distinct from new.created_at then
    raise exception using errcode = '55000',
      message = 'Invoice customer, item-summary, source, and financial snapshots are immutable.';
  end if;

  if old.status <> 'draft' and (
    old.issue_date is distinct from new.issue_date
    or old.issued_at is distinct from new.issued_at
    or old.due_at is distinct from new.due_at
    or old.issued_by is distinct from new.issued_by
  ) then
    raise exception using errcode = '55000',
      message = 'Issued Invoice dates and attribution are immutable.';
  end if;

  if new.amount_paid < 0 or new.amount_paid > new.total_amount
    or new.balance_due is distinct from round(new.total_amount - new.amount_paid, 2) then
    raise exception using errcode = '22023',
      message = 'Invoice payment totals and balance are inconsistent.';
  end if;

  if (new.amount_paid = 0 and new.payment_status <> 'unpaid')
    or (new.amount_paid > 0 and new.balance_due > 0 and new.payment_status <> 'partially_paid')
    or (new.balance_due = 0 and new.payment_status <> 'paid') then
    raise exception using errcode = '22023',
      message = 'Invoice payment status does not match its persisted balance.';
  end if;

  if old.status = 'draft' and new.status not in ('draft', 'issued', 'cancelled', 'void') then
    raise exception using errcode = '55000', message = 'Invalid Invoice lifecycle transition.';
  elsif old.status = 'issued' and new.status not in ('issued', 'partially_paid', 'paid', 'overdue', 'cancelled', 'void') then
    raise exception using errcode = '55000', message = 'Invalid Invoice lifecycle transition.';
  elsif old.status = 'partially_paid' and new.status not in ('partially_paid', 'paid', 'overdue', 'void') then
    raise exception using errcode = '55000', message = 'Invalid Invoice lifecycle transition.';
  elsif old.status = 'overdue' and new.status not in ('overdue', 'partially_paid', 'paid', 'void') then
    raise exception using errcode = '55000', message = 'Invalid Invoice lifecycle transition.';
  elsif old.status in ('paid', 'cancelled', 'void') and new.status is distinct from old.status then
    raise exception using errcode = '55000', message = 'Terminal Invoice states cannot be changed silently.';
  end if;

  if new.status <> 'draft' and new.issued_at is null and new.status not in ('cancelled', 'void') then
    raise exception using errcode = '55000', message = 'Issued Invoice states require an issued timestamp.';
  end if;

  return new;
end;
$$;

drop trigger if exists invoice_items_prevent_non_draft_insert
  on public.invoice_items;
create trigger invoice_items_prevent_non_draft_insert
before insert on public.invoice_items
for each row execute function private.prevent_non_draft_invoice_item_insert();

revoke all on function private.prevent_non_draft_invoice_item_insert()
  from public, anon, authenticated;
revoke all on function private.protect_invoice_snapshot()
  from public, anon, authenticated;
revoke all on function public.create_invoice_for_agreement(uuid)
  from public, anon, authenticated;
grant execute on function public.create_invoice_for_agreement(uuid)
  to authenticated;

do $$
begin
  if exists (
    select 1 from pg_catalog.pg_roles where rolname = 'service_role'
  ) then
    execute 'revoke insert, update, delete on public.invoice_items from service_role';
    execute 'revoke all on private.invoice_creation_contexts from service_role';
    execute 'revoke all on function private.create_invoice_for_agreement_transaction(uuid) from service_role';
    execute 'revoke all on function private.prevent_non_draft_invoice_item_insert() from service_role';
  end if;
end;
$$;

comment on function private.prevent_non_draft_invoice_item_insert() is
  'Serializes against the parent Invoice and permits immutable item creation only while the Invoice is draft.';
comment on function public.create_invoice_for_agreement(uuid) is
  'Authorizes one transactional creation context and delegates immutable Invoice aggregate persistence.';
