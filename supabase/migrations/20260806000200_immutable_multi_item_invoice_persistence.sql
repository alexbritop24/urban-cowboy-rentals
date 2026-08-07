-- Sprint 2B-C: immutable, Agreement-derived Invoice snapshots.
-- This migration is intentionally rerunnable under the repository's local
-- validation strategy. Existing legacy Invoice rows remain readable and are
-- never rewritten into normalized snapshots.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  rental_agreement_id uuid,
  rental_request_id uuid,
  invoice_number text not null,
  invoice_type text not null default 'original_rental',
  status text not null default 'draft',
  customer_type text,
  customer_name text not null,
  business_name text,
  customer_email text,
  customer_phone text,
  billing_address text,
  service_address text,
  equipment_requested text,
  rental_start_date timestamptz,
  rental_end_date timestamptz,
  source_agreement_snapshot_hash text,
  currency text not null default 'USD',
  payment_terms text not null default 'Due on receipt',
  subtotal numeric(12, 2) not null default 0,
  deposit_amount numeric(12, 2) not null default 0,
  delivery_fee numeric(12, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  other_charges_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  amount_paid numeric(12, 2) not null default 0,
  balance_due numeric(12, 2) not null default 0,
  payment_status text not null default 'unpaid',
  payment_link text,
  notes text,
  issue_date date,
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  voided_at timestamptz,
  created_by uuid,
  issued_by uuid,
  pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.invoices
  add column if not exists rental_agreement_id uuid,
  add column if not exists rental_request_id uuid,
  add column if not exists invoice_number text,
  add column if not exists invoice_type text not null default 'original_rental',
  add column if not exists status text not null default 'draft',
  add column if not exists customer_type text,
  add column if not exists customer_name text,
  add column if not exists business_name text,
  add column if not exists customer_email text,
  add column if not exists customer_phone text,
  add column if not exists billing_address text,
  add column if not exists service_address text,
  add column if not exists equipment_requested text,
  add column if not exists rental_start_date timestamptz,
  add column if not exists rental_end_date timestamptz,
  add column if not exists source_agreement_snapshot_hash text,
  add column if not exists currency text not null default 'USD',
  add column if not exists payment_terms text not null default 'Due on receipt',
  add column if not exists subtotal numeric(12, 2) not null default 0,
  add column if not exists deposit_amount numeric(12, 2) not null default 0,
  add column if not exists delivery_fee numeric(12, 2) not null default 0,
  add column if not exists tax_amount numeric(12, 2) not null default 0,
  add column if not exists other_charges_amount numeric(12, 2) not null default 0,
  add column if not exists total_amount numeric(12, 2) not null default 0,
  add column if not exists amount_paid numeric(12, 2) not null default 0,
  add column if not exists balance_due numeric(12, 2) not null default 0,
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists payment_link text,
  add column if not exists notes text,
  add column if not exists issue_date date,
  add column if not exists issued_at timestamptz,
  add column if not exists due_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists voided_at timestamptz,
  add column if not exists created_by uuid,
  add column if not exists issued_by uuid,
  add column if not exists pdf_url text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from public.invoices
    where rental_agreement_id is not null
      and invoice_type = 'original_rental'
    group by rental_agreement_id
    having count(*) > 1
  ) then
    raise exception using errcode = '23505',
      message = 'Cannot enforce one original Invoice per Agreement until duplicate Invoice rows are resolved.';
  end if;

  if exists (
    select 1 from public.invoices
    where invoice_number is not null
    group by invoice_number having count(*) > 1
  ) then
    raise exception using errcode = '23505',
      message = 'Cannot enforce unique Invoice numbers until duplicate Invoice rows are resolved.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.invoices'::regclass
      and conname = 'invoices_rental_agreement_fk'
  ) then
    alter table public.invoices
      add constraint invoices_rental_agreement_fk
      foreign key (rental_agreement_id)
      references public.rental_agreements(id)
      on update restrict on delete restrict not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.invoices'::regclass
      and conname = 'invoices_rental_request_fk'
  ) then
    alter table public.invoices
      add constraint invoices_rental_request_fk
      foreign key (rental_request_id)
      references public.rental_requests(id)
      on update restrict on delete restrict not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.invoices'::regclass
      and conname = 'invoices_type_check'
  ) then
    alter table public.invoices add constraint invoices_type_check
      check (invoice_type in ('original_rental', 'adjustment', 'credit_note', 'replacement', 'damage_charge'))
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.invoices'::regclass
      and conname = 'invoices_status_check'
  ) then
    alter table public.invoices add constraint invoices_status_check
      check (status in ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled', 'void'))
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.invoices'::regclass
      and conname = 'invoices_customer_type_check'
  ) then
    alter table public.invoices add constraint invoices_customer_type_check
      check (customer_type is null or customer_type in ('individual', 'business'))
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.invoices'::regclass
      and conname = 'invoices_currency_check'
  ) then
    alter table public.invoices add constraint invoices_currency_check
      check (currency ~ '^[A-Z]{3}$') not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.invoices'::regclass
      and conname = 'invoices_snapshot_hash_check'
  ) then
    alter table public.invoices add constraint invoices_snapshot_hash_check
      check (
        source_agreement_snapshot_hash is null
        or source_agreement_snapshot_hash ~ '^sha256:[0-9a-f]{64}$'
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.invoices'::regclass
      and conname = 'invoices_amounts_check'
  ) then
    alter table public.invoices add constraint invoices_amounts_check
      check (
        subtotal >= 0 and deposit_amount >= 0 and delivery_fee >= 0
        and tax_amount >= 0 and other_charges_amount >= 0
        and total_amount >= 0 and amount_paid >= 0 and balance_due >= 0
        and amount_paid <= total_amount
      ) not valid;
  end if;
end;
$$;

create unique index if not exists invoices_invoice_number_key
  on public.invoices (invoice_number)
  where invoice_number is not null;
create unique index if not exists invoices_original_agreement_key
  on public.invoices (rental_agreement_id)
  where rental_agreement_id is not null and invoice_type = 'original_rental';
create index if not exists invoices_rental_request_id_idx
  on public.invoices (rental_request_id)
  where rental_request_id is not null;
create index if not exists invoices_status_idx on public.invoices (status);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null,
  agreement_item_id uuid,
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
  constraint invoice_items_invoice_fk foreign key (invoice_id)
    references public.invoices(id) on update restrict on delete restrict,
  constraint invoice_items_agreement_item_fk foreign key (agreement_item_id)
    references public.agreement_items(id) on update restrict on delete restrict,
  constraint invoice_items_request_item_fk foreign key (rental_request_item_id)
    references public.rental_request_items(id) on update restrict on delete restrict,
  constraint invoice_items_display_order_check check (display_order >= 0),
  constraint invoice_items_equipment_name_check check (length(btrim(equipment_name)) > 0),
  constraint invoice_items_date_range_check check (end_date >= start_date),
  constraint invoice_items_quantity_check check (quantity > 0),
  constraint invoice_items_daily_rate_check check (daily_rate >= 0),
  constraint invoice_items_billable_days_check check (billable_days > 0),
  constraint invoice_items_line_total_check check (line_total >= 0),
  constraint invoice_items_serial_quantity_check check (serial_number is null or quantity = 1),
  constraint invoice_items_invoice_order_key unique (invoice_id, display_order),
  constraint invoice_items_invoice_agreement_item_key unique (invoice_id, agreement_item_id)
);

create index if not exists invoice_items_invoice_id_idx
  on public.invoice_items (invoice_id);
create index if not exists invoice_items_agreement_item_id_idx
  on public.invoice_items (agreement_item_id)
  where agreement_item_id is not null;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null,
  amount numeric(12, 2) not null,
  payment_method text not null,
  reference_number text,
  notes text,
  received_at timestamptz not null default now(),
  recorded_by uuid,
  created_at timestamptz not null default now()
);

alter table public.payments
  add column if not exists invoice_id uuid,
  add column if not exists amount numeric(12, 2),
  add column if not exists payment_method text,
  add column if not exists reference_number text,
  add column if not exists notes text,
  add column if not exists received_at timestamptz not null default now(),
  add column if not exists recorded_by uuid,
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.payments'::regclass
      and conname = 'payments_invoice_fk'
  ) then
    alter table public.payments add constraint payments_invoice_fk
      foreign key (invoice_id) references public.invoices(id)
      on update restrict on delete restrict not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.payments'::regclass
      and conname = 'payments_amount_check'
  ) then
    alter table public.payments add constraint payments_amount_check
      check (amount > 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.payments'::regclass
      and conname = 'payments_method_check'
  ) then
    alter table public.payments add constraint payments_method_check
      check (payment_method in ('cash', 'card', 'check', 'ach', 'square', 'stripe', 'other'))
      not valid;
  end if;
end;
$$;

create index if not exists payments_invoice_received_idx
  on public.payments (invoice_id, received_at desc);

create sequence if not exists public.invoice_number_seq;
revoke all on sequence public.invoice_number_seq from public, anon, authenticated;

create or replace function private.next_invoice_number()
returns text
language sql
volatile
security definer
set search_path = pg_catalog, public
as $$
  select 'INV-' || to_char(current_date, 'YYYY') || '-'
    || lpad(nextval('public.invoice_number_seq')::text, 6, '0');
$$;

create or replace function private.prevent_invoice_item_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  raise exception using errcode = '55000',
    message = 'Persisted Invoice item snapshots are immutable.';
end;
$$;

create or replace function private.prevent_finalized_agreement_item_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if exists (
    select 1 from public.rental_agreements agreements
    where agreements.id = new.rental_agreement_id
      and (
        agreements.status <> 'draft'
        or agreements.locked_at is not null
        or agreements.acceptance_acknowledged is true
        or agreements.signature_status <> 'pending'
      )
  ) then
    raise exception using errcode = '55000',
      message = 'Items cannot be added after Agreement acceptance or finalization.';
  end if;
  return new;
end;
$$;

create or replace function private.prevent_payment_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  raise exception using errcode = '55000',
    message = 'Payment history is append-only and cannot be changed or deleted.';
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
    or old.created_by is distinct from new.created_by then
    raise exception using errcode = '55000',
      message = 'Invoice customer, item-summary, source, and financial snapshots are immutable.';
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

drop trigger if exists invoice_items_prevent_update on public.invoice_items;
create trigger invoice_items_prevent_update before update on public.invoice_items
for each row execute function private.prevent_invoice_item_mutation();

drop trigger if exists agreement_items_prevent_finalized_insert
  on public.agreement_items;
create trigger agreement_items_prevent_finalized_insert
before insert on public.agreement_items
for each row execute function private.prevent_finalized_agreement_item_insert();
drop trigger if exists invoice_items_prevent_delete on public.invoice_items;
create trigger invoice_items_prevent_delete before delete on public.invoice_items
for each row execute function private.prevent_invoice_item_mutation();

drop trigger if exists payments_prevent_update on public.payments;
create trigger payments_prevent_update before update on public.payments
for each row execute function private.prevent_payment_mutation();
drop trigger if exists payments_prevent_delete on public.payments;
create trigger payments_prevent_delete before delete on public.payments
for each row execute function private.prevent_payment_mutation();

drop trigger if exists invoices_protect_snapshot on public.invoices;
create trigger invoices_protect_snapshot before update or delete on public.invoices
for each row execute function private.protect_invoice_snapshot();
drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at before update on public.invoices
for each row execute function private.set_current_timestamp_updated_at();

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('invoices', 'invoice_items', 'payments')
  loop
    execute format('drop policy if exists %I on %I.%I',
      policy_record.policyname, policy_record.schemaname, policy_record.tablename);
  end loop;
end;
$$;

create policy "staff can read invoices" on public.invoices
  for select to authenticated using (private.is_staff());
create policy "staff can read invoice items" on public.invoice_items
  for select to authenticated using (private.is_staff());
create policy "staff can read payments" on public.payments
  for select to authenticated using (private.is_staff());

revoke all on public.invoices from public, anon, authenticated;
revoke all on public.invoice_items from public, anon, authenticated;
revoke all on public.payments from public, anon, authenticated;
grant select on public.invoices to authenticated;
grant select on public.invoice_items to authenticated;
grant select on public.payments to authenticated;

create or replace function public.create_invoice_for_agreement(
  target_rental_agreement_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  agreement_record public.rental_agreements%rowtype;
  existing_invoice public.invoices%rowtype;
  new_invoice_id uuid;
  item_count integer;
  item_subtotal numeric(12, 2);
  expected_total numeric(12, 2);
  verified_snapshot_hash text;
begin
  if not private.is_staff() then
    raise exception using errcode = '42501',
      message = 'Staff authorization is required to create an Invoice.';
  end if;

  select * into agreement_record
  from public.rental_agreements
  where id = target_rental_agreement_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Rental Agreement not found.';
  end if;

  select * into existing_invoice
  from public.invoices
  where rental_agreement_id = target_rental_agreement_id
    and invoice_type = 'original_rental';

  if found then
    if existing_invoice.source_agreement_snapshot_hash is distinct from
      agreement_record.accepted_snapshot_hash then
      raise exception using errcode = '55000',
        message = 'The existing original Invoice is not traceable to the accepted Agreement snapshot.';
    end if;
    return existing_invoice.id;
  end if;

  if agreement_record.status <> 'ready' or agreement_record.locked_at is null then
    raise exception using errcode = '55000',
      message = 'A finalized Agreement is required before Invoice creation.';
  end if;

  if agreement_record.snapshot_schema_version <> 1
    or agreement_record.acceptance_acknowledged is not true
    or agreement_record.signature_status not in ('accepted', 'signed')
    or agreement_record.signed_at is null
    or nullif(agreement_record.accepted_snapshot_hash, '') is null
    or agreement_record.current_snapshot_hash is distinct from agreement_record.accepted_snapshot_hash then
    raise exception using errcode = '55000',
      message = 'Verified Agreement acceptance and matching snapshot hashes are required.';
  end if;

  verified_snapshot_hash := private.rental_agreement_snapshot_hash(target_rental_agreement_id);
  if verified_snapshot_hash is distinct from agreement_record.current_snapshot_hash
    or verified_snapshot_hash is distinct from agreement_record.accepted_snapshot_hash then
    raise exception using errcode = '55000',
      message = 'The Agreement material snapshot no longer matches its accepted snapshot.';
  end if;

  select count(*)::integer, coalesce(round(sum(line_total), 2), 0)
  into item_count, item_subtotal
  from public.agreement_items
  where rental_agreement_id = target_rental_agreement_id;

  if item_count < 1 then
    raise exception using errcode = '55000',
      message = 'At least one immutable Agreement item is required.';
  end if;

  if exists (
    select 1 from public.agreement_items
    where rental_agreement_id = target_rental_agreement_id
      and (
        nullif(btrim(equipment_name), '') is null
        or end_date < start_date or quantity <= 0 or daily_rate < 0
        or billable_days <= 0 or line_total < 0
        or round(daily_rate * quantity * billable_days, 2) is distinct from round(line_total, 2)
      )
  ) then
    raise exception using errcode = '22023',
      message = 'The Agreement item snapshot is incomplete or internally inconsistent.';
  end if;

  expected_total := round(
    item_subtotal + agreement_record.deposit_amount + agreement_record.delivery_fee
      + agreement_record.tax_amount,
    2
  );
  if item_subtotal is distinct from round(agreement_record.quote_amount, 2)
    or expected_total is distinct from round(agreement_record.total_amount, 2) then
    raise exception using errcode = '55000',
      message = 'Agreement item and financial snapshot totals are inconsistent.';
  end if;

  insert into public.invoices (
    rental_agreement_id, rental_request_id, invoice_number, invoice_type,
    status, customer_type, customer_name, business_name, customer_email,
    customer_phone, billing_address, service_address, equipment_requested,
    rental_start_date, rental_end_date, source_agreement_snapshot_hash,
    currency, payment_terms, subtotal, deposit_amount, delivery_fee,
    tax_amount, other_charges_amount, total_amount, amount_paid, balance_due,
    payment_status, created_by
  ) values (
    agreement_record.id, agreement_record.rental_request_id,
    private.next_invoice_number(), 'original_rental', 'draft',
    agreement_record.customer_type, agreement_record.customer_name,
    agreement_record.business_name, agreement_record.customer_email,
    agreement_record.customer_phone, agreement_record.billing_address,
    agreement_record.service_address, agreement_record.equipment_requested,
    agreement_record.rental_start_date, agreement_record.rental_end_date,
    verified_snapshot_hash, 'USD', 'Due on receipt', item_subtotal,
    agreement_record.deposit_amount, agreement_record.delivery_fee,
    agreement_record.tax_amount, 0, agreement_record.total_amount, 0,
    agreement_record.total_amount, 'unpaid', private.current_staff_actor_id()
  ) returning id into new_invoice_id;

  insert into public.invoice_items (
    invoice_id, agreement_item_id, rental_request_item_id, display_order,
    equipment_id, equipment_name, serial_number, start_date, end_date,
    quantity, daily_rate, billable_days, line_total, notes
  )
  select new_invoice_id, id, rental_request_item_id, display_order,
    equipment_id, equipment_name, serial_number, start_date, end_date,
    quantity, daily_rate, billable_days, line_total, notes
  from public.agreement_items
  where rental_agreement_id = target_rental_agreement_id
  order by display_order, id;

  if (select count(*) from public.invoice_items where invoice_id = new_invoice_id) <> item_count then
    raise exception using errcode = '55000',
      message = 'Invoice item snapshot persistence did not complete.';
  end if;

  return new_invoice_id;
exception
  when unique_violation then
    select * into existing_invoice
    from public.invoices
    where rental_agreement_id = target_rental_agreement_id
      and invoice_type = 'original_rental';
    if found and existing_invoice.source_agreement_snapshot_hash is not distinct from
      verified_snapshot_hash then
      return existing_invoice.id;
    end if;
    raise;
end;
$$;

create or replace function public.issue_invoice(target_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  invoice_record public.invoices%rowtype;
  agreement_record public.rental_agreements%rowtype;
  verified_snapshot_hash text;
begin
  if not private.is_staff() then
    raise exception using errcode = '42501',
      message = 'Staff authorization is required to issue an Invoice.';
  end if;

  select * into invoice_record from public.invoices
  where id = target_invoice_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Invoice not found.';
  end if;
  if invoice_record.status <> 'draft' then return invoice_record.id; end if;
  if invoice_record.invoice_type <> 'original_rental'
    or invoice_record.rental_agreement_id is null then
    raise exception using errcode = '55000',
      message = 'Only Agreement-derived original rental Invoices can be issued by this workflow.';
  end if;

  select * into agreement_record from public.rental_agreements
  where id = invoice_record.rental_agreement_id for update;
  if not found or agreement_record.status <> 'ready' or agreement_record.locked_at is null then
    raise exception using errcode = '55000',
      message = 'The source Agreement must remain finalized.';
  end if;

  verified_snapshot_hash := private.rental_agreement_snapshot_hash(agreement_record.id);
  if verified_snapshot_hash is distinct from agreement_record.accepted_snapshot_hash
    or invoice_record.source_agreement_snapshot_hash is distinct from verified_snapshot_hash then
    raise exception using errcode = '55000',
      message = 'Invoice issuance failed Agreement snapshot verification.';
  end if;

  if not exists (select 1 from public.invoice_items where invoice_id = target_invoice_id)
    or invoice_record.subtotal is distinct from (
      select round(sum(line_total), 2) from public.invoice_items where invoice_id = target_invoice_id
    )
    or invoice_record.total_amount is distinct from round(
      invoice_record.subtotal + invoice_record.deposit_amount
        + invoice_record.delivery_fee + invoice_record.tax_amount
        + invoice_record.other_charges_amount,
      2
    ) then
    raise exception using errcode = '55000',
      message = 'Invoice item and financial snapshots are incomplete or inconsistent.';
  end if;

  update public.invoices set
    status = 'issued', issue_date = current_date, issued_at = now(),
    due_at = coalesce(due_at, now()), issued_by = private.current_staff_actor_id()
  where id = target_invoice_id;
  return target_invoice_id;
end;
$$;

create or replace function public.record_invoice_payment(
  target_invoice_id uuid,
  payment_amount numeric,
  payment_method_value text,
  reference_number_value text default null,
  notes_value text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  invoice_record public.invoices%rowtype;
  new_payment_id uuid;
  next_amount_paid numeric(12, 2);
  next_balance numeric(12, 2);
  next_status text;
begin
  if not private.is_staff() then
    raise exception using errcode = '42501',
      message = 'Staff authorization is required to record a Payment.';
  end if;
  if payment_amount is null or payment_amount <= 0 then
    raise exception using errcode = '22023', message = 'Payment amount must be greater than zero.';
  end if;
  if payment_method_value not in ('cash', 'card', 'check', 'ach', 'square', 'stripe', 'other') then
    raise exception using errcode = '22023', message = 'Payment method is invalid.';
  end if;
  if length(coalesce(reference_number_value, '')) > 200
    or length(coalesce(notes_value, '')) > 2000 then
    raise exception using errcode = '22023', message = 'Payment reference or notes exceed allowed limits.';
  end if;

  select * into invoice_record from public.invoices
  where id = target_invoice_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Invoice not found.'; end if;
  if invoice_record.status not in ('issued', 'partially_paid', 'overdue') then
    raise exception using errcode = '55000',
      message = 'Payments require an issued, partially paid, or overdue Invoice.';
  end if;
  if payment_amount > invoice_record.balance_due then
    raise exception using errcode = '22023', message = 'Payment cannot exceed the remaining balance.';
  end if;

  next_amount_paid := round(invoice_record.amount_paid + payment_amount, 2);
  next_balance := round(invoice_record.total_amount - next_amount_paid, 2);
  next_status := case when next_balance = 0 then 'paid' else 'partially_paid' end;

  insert into public.payments (
    invoice_id, amount, payment_method, reference_number, notes,
    received_at, recorded_by
  ) values (
    target_invoice_id, round(payment_amount, 2), payment_method_value,
    nullif(btrim(reference_number_value), ''), nullif(btrim(notes_value), ''),
    now(), private.current_staff_actor_id()
  ) returning id into new_payment_id;

  update public.invoices set
    amount_paid = next_amount_paid,
    balance_due = next_balance,
    payment_status = case when next_balance = 0 then 'paid' else 'partially_paid' end,
    status = next_status,
    paid_at = case when next_balance = 0 then now() else null end
  where id = target_invoice_id;

  return new_payment_id;
end;
$$;

revoke all on function private.next_invoice_number() from public, anon, authenticated;
revoke all on function private.prevent_finalized_agreement_item_insert()
  from public, anon, authenticated;
revoke all on function private.prevent_invoice_item_mutation() from public, anon, authenticated;
revoke all on function private.prevent_payment_mutation() from public, anon, authenticated;
revoke all on function private.protect_invoice_snapshot() from public, anon, authenticated;

revoke all on function public.create_invoice_for_agreement(uuid) from public, anon, authenticated;
grant execute on function public.create_invoice_for_agreement(uuid) to authenticated;
revoke all on function public.issue_invoice(uuid) from public, anon, authenticated;
grant execute on function public.issue_invoice(uuid) to authenticated;
revoke all on function public.record_invoice_payment(uuid, numeric, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_invoice_payment(uuid, numeric, text, text, text)
  to authenticated;

comment on function public.create_invoice_for_agreement(uuid) is
  'Creates or safely returns one immutable original Invoice derived exclusively from a finalized Agreement snapshot.';
comment on column public.invoices.source_agreement_snapshot_hash is
  'Accepted SHA-256 material snapshot hash of the finalized source Agreement.';
