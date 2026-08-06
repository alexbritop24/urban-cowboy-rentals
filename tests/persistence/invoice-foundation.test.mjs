import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const migrationUrls = [
  new URL("../../supabase/migrations/20260805000000_rental_requests_compatibility_baseline.sql", import.meta.url),
  new URL("../../supabase/migrations/20260805000100_rental_request_items_persistence.sql", import.meta.url),
  new URL("../../supabase/migrations/20260805000200_rental_agreement_snapshot_persistence.sql", import.meta.url),
  new URL("../../supabase/migrations/20260806000100_agreement_legal_integrity_remediation.sql", import.meta.url),
  new URL("../../supabase/migrations/20260806000200_immutable_multi_item_invoice_persistence.sql", import.meta.url),
];

const createDatabase = async (migrationCount = migrationUrls.length) => {
  const database = new PGlite({ extensions: { pgcrypto } });
  await database.exec(`
    create schema if not exists extensions;
    create extension if not exists pgcrypto with schema extensions;
    create role anon nologin;
    create role authenticated nologin;
  `);
  for (const migrationUrl of migrationUrls.slice(0, migrationCount)) {
    await database.exec(await readFile(migrationUrl, "utf8"));
  }
  return database;
};

const setRole = async (database, role, claims = {}) => {
  await database.exec(`set role ${role}`);
  await database.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ role, ...claims }),
  ]);
};

const resetRole = async (database) => {
  await database.exec("reset role");
  await database.query("select set_config('request.jwt.claims', '', false)");
};

const expectDatabaseError = async (operation, expectedText) => {
  await assert.rejects(operation, (error) => {
    assert.match(error.message, new RegExp(expectedText, "i"));
    return true;
  });
};

const isoDaysFromNow = (days) => {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  value.setUTCHours(16, 0, 0, 0);
  return value.toISOString();
};

const requestPayload = {
  customer_type: "business",
  business_name: "Invoice Snapshot LLC",
  full_name: "Morgan Invoice",
  phone: "8015550177",
  email: "invoice-snapshot@example.test",
  fulfillment_type: "Delivery",
  project_type: "Invoice persistence validation",
  notes: "Persist every item",
  agreement_accepted: true,
};

const requestItems = [
  {
    equipment_id: "bobcat-t550-skid-steer",
    start_date: isoDaysFromNow(10),
    end_date: isoDaysFromNow(12),
    quantity: 1,
    notes: "Loader line",
  },
  {
    equipment_id: "wacker-rd12-roller",
    start_date: isoDaysFromNow(14),
    end_date: isoDaysFromNow(17),
    quantity: 1,
    notes: "Roller line",
  },
];

const staffClaims = {
  app_metadata: { role: "staff" },
  sub: "11111111-1111-4111-8111-111111111111",
};

const prepareFinalizedAgreement = async (database) => {
  await database.exec(`
    update private.release_feature_flags set enabled = true
    where feature_key = 'multi_item_rental_requests';
    insert into public.agreement_clauses (
      clause_key, title, body, display_order, enabled, category, version
    ) values (
      'invoice-source', 'Invoice Source Terms',
      'Finalized Agreement snapshots are the only Invoice source.',
      0, true, 'general', 1
    );
  `);

  await setRole(database, "anon");
  const request = await database.query(
    "select public.create_rental_request_with_items($1::jsonb, $2::jsonb) as id",
    [JSON.stringify(requestPayload), JSON.stringify(requestItems)]
  );
  await resetRole(database);
  const requestId = request.rows[0].id;

  await database.query(`
    update public.rental_requests set
      availability_status = 'available',
      insurance_verification_status = 'verified',
      billing_address = '100 Billing Avenue',
      service_address = '200 Delivery Road'
    where id = $1
  `, [requestId]);

  await setRole(database, "authenticated", staffClaims);
  const agreement = await database.query(
    "select public.create_rental_agreement_for_request($1::uuid) as id",
    [requestId]
  );
  const agreementId = agreement.rows[0].id;
  await database.query(
    "select public.update_rental_agreement_financials($1::uuid, 100, 50, 25)",
    [agreementId]
  );
  await database.query(
    "select public.record_rental_agreement_acceptance($1::uuid, 'Morgan Invoice', 'Owner', true, true)",
    [agreementId]
  );
  await database.query("select public.finalize_rental_agreement($1::uuid)", [agreementId]);
  await resetRole(database);
  return { agreementId, requestId };
};

test("original Invoice creation is Agreement-derived, idempotent, traceable, and immutable", async (t) => {
  const database = await createDatabase();
  t.after(() => database.close());
  const { agreementId, requestId } = await prepareFinalizedAgreement(database);

  await setRole(database, "anon");
  await expectDatabaseError(
    () => database.query("select public.create_invoice_for_agreement($1::uuid)", [agreementId]),
    "permission denied"
  );
  await resetRole(database);

  await setRole(database, "authenticated", { app_metadata: { role: "customer" } });
  await expectDatabaseError(
    () => database.query("select public.create_invoice_for_agreement($1::uuid)", [agreementId]),
    "Staff authorization"
  );
  assert.equal((await database.query("select id from public.invoices")).rows.length, 0);
  await resetRole(database);

  await setRole(database, "authenticated", staffClaims);
  const created = await Promise.all([
    database.query("select public.create_invoice_for_agreement($1::uuid) as id", [agreementId]),
    database.query("select public.create_invoice_for_agreement($1::uuid) as id", [agreementId]),
  ]);
  const invoiceId = created[0].rows[0].id;
  assert.equal(created[1].rows[0].id, invoiceId);
  await resetRole(database);

  const invoice = await database.query(`
    select invoice_number, invoice_type, status, rental_request_id,
      customer_type, customer_name, business_name, customer_email,
      customer_phone, billing_address, service_address,
      source_agreement_snapshot_hash, subtotal::text, deposit_amount::text,
      delivery_fee::text, tax_amount::text, total_amount::text,
      amount_paid::text, balance_due::text,
      source_agreement_snapshot_hash = (
        select accepted_snapshot_hash from public.rental_agreements where id = $2
      ) as hash_matches
    from public.invoices where id = $1
  `, [invoiceId, agreementId]);
  assert.match(invoice.rows[0].invoice_number, /^INV-\d{4}-\d{6}$/);
  assert.deepEqual(invoice.rows[0], {
    invoice_number: invoice.rows[0].invoice_number,
    invoice_type: "original_rental",
    status: "draft",
    rental_request_id: requestId,
    customer_type: "business",
    customer_name: "Morgan Invoice",
    business_name: "Invoice Snapshot LLC",
    customer_email: "invoice-snapshot@example.test",
    customer_phone: "8015550177",
    billing_address: "100 Billing Avenue",
    service_address: "200 Delivery Road",
    source_agreement_snapshot_hash: invoice.rows[0].source_agreement_snapshot_hash,
    subtotal: "780.00",
    deposit_amount: "100.00",
    delivery_fee: "50.00",
    tax_amount: "25.00",
    total_amount: "955.00",
    amount_paid: "0.00",
    balance_due: "955.00",
    hash_matches: true,
  });
  assert.match(invoice.rows[0].source_agreement_snapshot_hash, /^sha256:[0-9a-f]{64}$/);

  const items = await database.query(`
    select agreement_item_id, rental_request_item_id, equipment_id,
      equipment_name, serial_number, start_date, end_date, quantity,
      daily_rate::text, billable_days, line_total::text, notes, display_order
    from public.invoice_items where invoice_id = $1 order by display_order
  `, [invoiceId]);
  assert.equal(items.rows.length, 2);
  assert.deepEqual(items.rows.map((item) => ({
    name: item.equipment_name,
    serial: item.serial_number,
    rate: item.daily_rate,
    days: item.billable_days,
    total: item.line_total,
    order: item.display_order,
    agreementLineage: typeof item.agreement_item_id === "string",
    requestLineage: typeof item.rental_request_item_id === "string",
  })), [
    {
      name: "2024 Bobcat T550 Track Loader", serial: "B57T133070",
      rate: "120.00", days: 2, total: "240.00", order: 0,
      agreementLineage: true, requestLineage: true,
    },
    {
      name: "Wacker Neuson RD12 Roller", serial: "WNCRD12AEPUM06214",
      rate: "180.00", days: 3, total: "540.00", order: 1,
      agreementLineage: true, requestLineage: true,
    },
  ]);

  await database.exec(`
    update private.rental_equipment_catalog set equipment_name = 'Changed Catalog', daily_rate = 999
    where equipment_id = 'bobcat-t550-skid-steer';
    update public.rental_requests set full_name = 'Changed Request Customer' where id = '${requestId}';
    update public.agreement_clauses set body = 'Changed future clause' where clause_key = 'invoice-source';
  `);
  const unchanged = await database.query(`
    select customer_name, subtotal::text from public.invoices where id = $1
  `, [invoiceId]);
  assert.deepEqual(unchanged.rows[0], { customer_name: "Morgan Invoice", subtotal: "780.00" });
  assert.equal(
    (await database.query("select equipment_name from public.invoice_items where invoice_id = $1 order by display_order limit 1", [invoiceId])).rows[0].equipment_name,
    "2024 Bobcat T550 Track Loader"
  );

  await expectDatabaseError(
    () => database.query("update public.invoice_items set daily_rate = 1 where invoice_id = $1", [invoiceId]),
    "immutable"
  );
  await expectDatabaseError(
    () => database.query(`
      insert into public.agreement_items (
        rental_agreement_id, display_order, equipment_name, start_date,
        end_date, quantity, daily_rate, billable_days, line_total
      ) values ($1, 99, 'Late Source Mutation', now(), now(), 1, 0, 1, 0)
    `, [agreementId]),
    "after Agreement acceptance or finalization"
  );
  await expectDatabaseError(
    () => database.query("update public.invoices set subtotal = 1 where id = $1", [invoiceId]),
    "immutable"
  );
  await expectDatabaseError(
    () => database.query("delete from public.invoices where id = $1", [invoiceId]),
    "cannot be hard-deleted"
  );
  await expectDatabaseError(
    () => database.query(`
      insert into public.invoices (
        rental_agreement_id, rental_request_id, invoice_number, customer_name
      ) values ($1, $2, 'INV-DUPLICATE', 'Duplicate')
    `, [agreementId, requestId]),
    "unique"
  );

  await setRole(database, "authenticated", staffClaims);
  await expectDatabaseError(
    () => database.query(`
      insert into public.invoice_items (
        invoice_id, display_order, equipment_name, start_date, end_date,
        quantity, daily_rate, billable_days, line_total
      ) values ($1, 9, 'Bypass', now(), now(), 1, 1, 1, 1)
    `, [invoiceId]),
    "permission denied"
  );
  await resetRole(database);
});

test("issuance and Payment recording are staff-only, transactional, and balance-safe", async (t) => {
  const database = await createDatabase();
  t.after(() => database.close());
  const { agreementId } = await prepareFinalizedAgreement(database);
  await setRole(database, "authenticated", staffClaims);
  const created = await database.query(
    "select public.create_invoice_for_agreement($1::uuid) as id", [agreementId]
  );
  const invoiceId = created.rows[0].id;
  await database.query("select public.issue_invoice($1::uuid)", [invoiceId]);
  const issued = await database.query(
    "select status, issued_at is not null as issued, issue_date is not null as issue_date from public.invoices where id = $1",
    [invoiceId]
  );
  assert.deepEqual(issued.rows[0], { status: "issued", issued: true, issue_date: true });
  await resetRole(database);

  await database.exec(`
    create function public.reject_invoice_payment_update_fixture()
    returns trigger language plpgsql as $$
    begin raise exception 'forced Invoice update failure'; end;
    $$;
    create trigger reject_invoice_payment_update_fixture
    before update on public.invoices
    for each row when (new.amount_paid > old.amount_paid)
    execute function public.reject_invoice_payment_update_fixture();
  `);
  await setRole(database, "authenticated", staffClaims);
  await expectDatabaseError(
    () => database.query(
      "select public.record_invoice_payment($1::uuid, 100, 'cash', null, 'rollback')",
      [invoiceId]
    ),
    "forced Invoice update failure"
  );
  assert.equal(
    (await database.query("select count(*)::integer as count from public.payments where invoice_id = $1", [invoiceId])).rows[0].count,
    0
  );
  await resetRole(database);
  await database.exec("drop trigger reject_invoice_payment_update_fixture on public.invoices");
  await setRole(database, "authenticated", staffClaims);

  const firstPayment = await database.query(
    "select public.record_invoice_payment($1::uuid, 400, 'square', 'SQ-100', 'Partial') as id",
    [invoiceId]
  );
  assert.equal(typeof firstPayment.rows[0].id, "string");
  let balance = await database.query(
    "select status, payment_status, amount_paid::text, balance_due::text from public.invoices where id = $1",
    [invoiceId]
  );
  assert.deepEqual(balance.rows[0], {
    status: "partially_paid", payment_status: "partially_paid",
    amount_paid: "400.00", balance_due: "555.00",
  });
  await expectDatabaseError(
    () => database.query(
      "select public.record_invoice_payment($1::uuid, 556, 'cash', null, null)",
      [invoiceId]
    ),
    "exceed"
  );
  await database.query(
    "select public.record_invoice_payment($1::uuid, 555, 'ach', 'ACH-200', null)",
    [invoiceId]
  );
  balance = await database.query(
    "select status, payment_status, amount_paid::text, balance_due::text, paid_at is not null as paid from public.invoices where id = $1",
    [invoiceId]
  );
  assert.deepEqual(balance.rows[0], {
    status: "paid", payment_status: "paid", amount_paid: "955.00",
    balance_due: "0.00", paid: true,
  });
  await resetRole(database);
  await expectDatabaseError(
    () => database.query("update public.payments set amount = 1 where invoice_id = $1", [invoiceId]),
    "append-only"
  );

  await setRole(database, "authenticated", { app_metadata: { role: "customer" } });
  assert.equal((await database.query("select id from public.invoices")).rows.length, 0);
  assert.equal((await database.query("select id from public.invoice_items")).rows.length, 0);
  assert.equal((await database.query("select id from public.payments")).rows.length, 0);
  await expectDatabaseError(
    () => database.query(
      "select public.record_invoice_payment($1::uuid, 1, 'cash', null, null)",
      [invoiceId]
    ),
    "Staff authorization"
  );
  await resetRole(database);
});

test("Invoice creation rejects unfinalized, unverifiable, empty, and inconsistent Agreements", async (t) => {
  const database = await createDatabase();
  t.after(() => database.close());
  await database.exec(`
    insert into public.agreement_clauses (
      clause_key, title, body, display_order, enabled, category, version
    ) values ('invoice-negative', 'Negative cases', 'Test clause', 0, true, 'general', 1)
  `);
  const request = await database.query(`
    insert into public.rental_requests (
      full_name, phone, email, equipment_requested, agreement_accepted,
      rental_start_date, rental_end_date, availability_status,
      insurance_verification_status
    ) values (
      'Draft Agreement', '8015550100', 'draft-invoice@example.test',
      'Historical Equipment', true, current_date + 10, current_date + 12,
      'available', 'verified'
    ) returning id
  `);
  await setRole(database, "authenticated", staffClaims);
  const draft = await database.query(
    "select public.create_rental_agreement_for_request($1::uuid) as id",
    [request.rows[0].id]
  );
  await expectDatabaseError(
    () => database.query("select public.create_invoice_for_agreement($1::uuid)", [draft.rows[0].id]),
    "finalized Agreement"
  );
  await resetRole(database);

  const source = await prepareFinalizedAgreement(database);
  const mismatchRequest = await database.query(`
    insert into public.rental_requests (
      full_name, phone, email, equipment_requested, agreement_accepted
    ) values ('Mismatch', '8015550101', 'mismatch@example.test', 'Mismatch', true)
    returning id
  `);
  const mismatch = await database.query(`
    insert into public.rental_agreements (
      rental_request_id, agreement_number, status, customer_type,
      customer_name, customer_email, customer_phone, equipment_requested,
      quote_amount, total_amount, signature_status, acceptance_acknowledged,
      authorized_signer_name, accepted_terms_version,
      credit_card_authorization_acknowledged,
      credit_card_authorization_acknowledged_at, insurance_verification_status,
      availability_confirmation_status, terms_version, clause_snapshot,
      clause_snapshot_created_at, snapshot_schema_version,
      current_snapshot_hash, accepted_snapshot_hash,
      credit_card_authorization_terms, signed_at, locked_at
    )
    select $1, 'UCR-MISMATCH', 'draft', customer_type, customer_name,
      customer_email, customer_phone, equipment_requested, quote_amount,
      total_amount, 'pending', false, null,
      null, false, null, insurance_verification_status,
      availability_confirmation_status, terms_version, clause_snapshot,
      clause_snapshot_created_at, 1,
      'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      null,
      credit_card_authorization_terms, null, null
    from public.rental_agreements where id = $2 returning id
  `, [mismatchRequest.rows[0].id, source.agreementId]);
  await database.query(`
    insert into public.agreement_items (
      rental_agreement_id, display_order, equipment_id, equipment_name,
      serial_number, start_date, end_date, quantity, daily_rate,
      billable_days, line_total, notes
    ) select $1, display_order, equipment_id, equipment_name, serial_number,
      start_date, end_date, quantity, daily_rate, billable_days, line_total, notes
    from public.agreement_items where rental_agreement_id = $2
  `, [mismatch.rows[0].id, source.agreementId]);
  await database.query(`
    update public.rental_agreements set
      status = 'ready', signature_status = 'accepted',
      acceptance_acknowledged = true, authorized_signer_name = 'Mismatch',
      accepted_terms_version = terms_version,
      accepted_snapshot_hash = current_snapshot_hash,
      credit_card_authorization_acknowledged = true,
      credit_card_authorization_acknowledged_at = now(), signed_at = now(),
      locked_at = now()
    where id = $1
  `, [mismatch.rows[0].id]);
  await setRole(database, "authenticated", staffClaims);
  await expectDatabaseError(
    () => database.query("select public.create_invoice_for_agreement($1::uuid)", [mismatch.rows[0].id]),
    "no longer matches"
  );
  await resetRole(database);

  for (const fixture of [
    { label: "EMPTY", quote: 0, addItem: false },
    { label: "INCONSISTENT", quote: 999, addItem: true },
  ]) {
    const fixtureRequest = await database.query(`
      insert into public.rental_requests (
        full_name, phone, email, equipment_requested, agreement_accepted
      ) values ($1, '8015550102', $2, $1, true) returning id
    `, [fixture.label, `${fixture.label.toLowerCase()}@example.test`]);
    const fixtureAgreement = await database.query(`
      insert into public.rental_agreements (
        rental_request_id, agreement_number, status, customer_type,
        customer_name, customer_email, customer_phone, equipment_requested,
        quote_amount, total_amount, signature_status, acceptance_acknowledged,
        credit_card_authorization_acknowledged, insurance_verification_status,
        availability_confirmation_status, terms_version, clause_snapshot,
        clause_snapshot_created_at, snapshot_schema_version,
        credit_card_authorization_terms
      )
      select $1, $2, 'draft', customer_type, $3, customer_email,
        customer_phone, $3, $4, $4, 'pending', false, false,
        insurance_verification_status, availability_confirmation_status,
        terms_version, clause_snapshot, clause_snapshot_created_at, 1,
        credit_card_authorization_terms
      from public.rental_agreements where id = $5 returning id
    `, [
      fixtureRequest.rows[0].id,
      `UCR-${fixture.label}`,
      fixture.label,
      fixture.quote,
      source.agreementId,
    ]);
    const fixtureAgreementId = fixtureAgreement.rows[0].id;
    if (fixture.addItem) {
      await database.query(`
        insert into public.agreement_items (
          rental_agreement_id, display_order, equipment_name, start_date,
          end_date, quantity, daily_rate, billable_days, line_total
        ) values ($1, 0, 'Inconsistent Snapshot', now(), now() + interval '2 days',
          1, 100, 2, 999)
      `, [fixtureAgreementId]);
    }
    await database.query(`
      update public.rental_agreements
      set current_snapshot_hash = private.rental_agreement_snapshot_hash(id)
      where id = $1
    `, [fixtureAgreementId]);
    await database.query(`
      update public.rental_agreements set
        status = 'ready', signature_status = 'accepted',
        acceptance_acknowledged = true, authorized_signer_name = $2,
        accepted_terms_version = terms_version,
        accepted_snapshot_hash = current_snapshot_hash,
        credit_card_authorization_acknowledged = true,
        credit_card_authorization_acknowledged_at = now(), signed_at = now(),
        locked_at = now()
      where id = $1
    `, [fixtureAgreementId, fixture.label]);
    await setRole(database, "authenticated", staffClaims);
    await expectDatabaseError(
      () => database.query(
        "select public.create_invoice_for_agreement($1::uuid)",
        [fixtureAgreementId]
      ),
      fixture.addItem ? "internally inconsistent" : "At least one"
    );
    await resetRole(database);
  }
});

test("forward migration preserves historical single-item Invoices and is rerunnable", async (t) => {
  const database = await createDatabase(4);
  t.after(() => database.close());
  const request = await database.query(`
    insert into public.rental_requests (
      full_name, phone, email, equipment_requested, rental_start_date,
      rental_end_date, agreement_accepted
    ) values (
      'Historical Customer', '8015550100', 'historical-invoice@example.test',
      'Stored Legacy Roller', current_date - 10, current_date - 7, true
    ) returning id
  `);
  await database.exec(`
    create table public.invoices (
      id uuid primary key default gen_random_uuid(),
      rental_agreement_id uuid,
      rental_request_id uuid,
      invoice_number text,
      status text not null default 'paid',
      customer_name text,
      customer_email text,
      customer_phone text,
      equipment_requested text,
      rental_start_date timestamptz,
      rental_end_date timestamptz,
      subtotal numeric(12,2) not null default 0,
      deposit_amount numeric(12,2) not null default 0,
      delivery_fee numeric(12,2) not null default 0,
      tax_amount numeric(12,2) not null default 0,
      total_amount numeric(12,2) not null default 0,
      amount_paid numeric(12,2) not null default 0,
      balance_due numeric(12,2) not null default 0,
      payment_status text not null default 'paid',
      payment_link text, notes text, issued_at timestamptz, due_at timestamptz,
      paid_at timestamptz, pdf_url text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table public.payments (
      id uuid primary key default gen_random_uuid(), invoice_id uuid,
      amount numeric(12,2), payment_method text, reference_number text,
      notes text, received_at timestamptz not null default now(),
      created_at timestamptz not null default now()
    );
  `);
  const legacy = await database.query(`
    insert into public.invoices (
      rental_request_id, invoice_number, status, customer_name, customer_email,
      equipment_requested, rental_start_date, rental_end_date, subtotal,
      total_amount, amount_paid, balance_due, payment_status, paid_at
    ) values (
      $1, 'INV-LEGACY-001', 'paid', 'Historical Customer',
      'historical-invoice@example.test', 'Stored Legacy Roller',
      current_date - 10, current_date - 7, 333.33, 333.33, 333.33, 0,
      'paid', now()
    ) returning id
  `, [request.rows[0].id]);

  const invoiceMigration = await readFile(migrationUrls.at(-1), "utf8");
  await database.exec(invoiceMigration);
  await database.exec(invoiceMigration);

  const preserved = await database.query(`
    select invoice_number, status, equipment_requested, subtotal::text,
      total_amount::text, amount_paid::text, balance_due::text,
      source_agreement_snapshot_hash, invoice_type
    from public.invoices where id = $1
  `, [legacy.rows[0].id]);
  assert.deepEqual(preserved.rows[0], {
    invoice_number: "INV-LEGACY-001", status: "paid",
    equipment_requested: "Stored Legacy Roller", subtotal: "333.33",
    total_amount: "333.33", amount_paid: "333.33", balance_due: "0.00",
    source_agreement_snapshot_hash: null, invoice_type: "original_rental",
  });
  assert.equal(
    (await database.query("select count(*)::integer as count from public.invoice_items where invoice_id = $1", [legacy.rows[0].id])).rows[0].count,
    0
  );
});

test("Invoice migration exposes only least-privilege staff RPC boundaries", async (t) => {
  const database = await createDatabase();
  t.after(() => database.close());

  const security = await database.query(`
    select p.proname, p.proargnames, pg_get_function_result(p.oid) as result_type,
      p.prosecdef as security_definer, p.proconfig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'create_invoice_for_agreement', 'issue_invoice', 'record_invoice_payment'
    ) order by p.proname
  `);
  assert.equal(security.rows.length, 3);
  for (const rpc of security.rows) {
    assert.equal(rpc.security_definer, true);
    assert.deepEqual(rpc.proconfig, ["search_path=pg_catalog, public, private"]);
    assert.equal(rpc.result_type, "uuid");
  }

  const privileges = await database.query(`
    select
      has_table_privilege('authenticated', 'public.invoices', 'insert') as invoice_insert,
      has_table_privilege('authenticated', 'public.invoices', 'update') as invoice_update,
      has_table_privilege('authenticated', 'public.invoice_items', 'insert') as item_insert,
      has_table_privilege('authenticated', 'public.payments', 'insert') as payment_insert,
      has_function_privilege('anon', 'public.create_invoice_for_agreement(uuid)', 'execute') as anon_create,
      has_function_privilege('authenticated', 'public.create_invoice_for_agreement(uuid)', 'execute') as auth_create,
      has_function_privilege('authenticated', 'public.issue_invoice(uuid)', 'execute') as auth_issue,
      has_function_privilege('authenticated', 'public.record_invoice_payment(uuid,numeric,text,text,text)', 'execute') as auth_payment
  `);
  assert.deepEqual(privileges.rows[0], {
    invoice_insert: false, invoice_update: false, item_insert: false,
    payment_insert: false, anon_create: false, auth_create: true,
    auth_issue: true, auth_payment: true,
  });

  const gates = await database.query(`
    select feature_key, enabled from private.release_feature_flags order by feature_key
  `);
  assert.deepEqual(gates.rows, [
    { feature_key: "multi_item_rental_requests", enabled: false },
  ]);

  const numbers = await database.query(`
    select private.next_invoice_number() as first,
      private.next_invoice_number() as second
  `);
  assert.notEqual(numbers.rows[0].first, numbers.rows[0].second);
  assert.match(numbers.rows[0].first, /^INV-\d{4}-\d{6}$/);
});

test("Invoice PDF rendering is snapshot-only", async () => {
  const pdfSource = await readFile(
    new URL("../../src/components/agreement/pdf/InvoicePdfDocument.tsx", import.meta.url),
    "utf8"
  );
  const generatorSource = await readFile(
    new URL("../../src/utils/generateInvoicePdf.tsx", import.meta.url),
    "utf8"
  );
  const combined = `${pdfSource}\n${generatorSource}`;
  assert.match(pdfSource, /invoice\.items\.map/);
  assert.match(pdfSource, /item_source/);
  assert.doesNotMatch(combined, /supabase|rental_request_items|equipmentData|agreementService/);
  assert.doesNotMatch(combined, /\.from\s*\(/);
});
