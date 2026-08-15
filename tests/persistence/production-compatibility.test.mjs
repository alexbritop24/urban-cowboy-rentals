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
  new URL("../../supabase/migrations/20260806000300_invoice_snapshot_integrity_remediation.sql", import.meta.url),
  new URL("../../supabase/migrations/20260807000100_private_rental_document_workflow.sql", import.meta.url),
  new URL("../../supabase/migrations/20260808000100_rental_approval_workflow.sql", import.meta.url),
  new URL("../../supabase/migrations/20260809000100_release1_production_shape_reconciliation.sql", import.meta.url),
];

const reconciliationUrl = migrationUrls.at(-1);
const requestIds = {
  duplicate: "10000000-0000-4000-8000-000000000001",
  noInvoice: "10000000-0000-4000-8000-000000000002",
  rawmax: "10000000-0000-4000-8000-000000000003",
};
const readyAgreementIds = {
  duplicate: "20000000-0000-4000-8000-000000000015",
  noInvoice: "20000000-0000-4000-8000-000000000016",
  rawmax: "20000000-0000-4000-8000-000000000017",
};
const invoiceIds = [
  "30000000-0000-4000-8000-000000000001",
  "30000000-0000-4000-8000-000000000002",
];

const createDatabase = async () => {
  const database = new PGlite({ extensions: { pgcrypto } });
  await database.exec(`
    create schema extensions;
    create extension pgcrypto with schema extensions;
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema storage;
    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean not null default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text not null,
      name text not null,
      metadata jsonb,
      created_at timestamptz not null default now(),
      unique (bucket_id, name)
    );
    alter table storage.objects enable row level security;
  `);
  return database;
};

const applyMigration = async (database, migrationUrl) => {
  await database.exec(await readFile(migrationUrl, "utf8"));
};

const applyMigrations = async (database, start, end = migrationUrls.length) => {
  for (const migrationUrl of migrationUrls.slice(start, end)) {
    await applyMigration(database, migrationUrl);
  }
};

const createLegacyProductionTables = async (database) => {
  await database.exec(`
    create table public.rental_agreements (
      id uuid primary key,
      rental_request_id uuid not null,
      agreement_number text not null,
      status text not null default 'draft',
      customer_name text not null,
      customer_email text not null,
      customer_phone text not null,
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
      clause_snapshot jsonb,
      sent_at timestamptz,
      viewed_at timestamptz,
      signed_at timestamptz,
      locked_at timestamptz,
      created_at timestamptz not null,
      constraint legacy_agreement_request_cascade_fk
        foreign key (rental_request_id) references public.rental_requests(id)
        on delete cascade
    );

    create table public.invoices (
      id uuid primary key,
      rental_agreement_id uuid,
      rental_request_id uuid,
      invoice_number text not null,
      status text not null,
      customer_name text not null,
      customer_email text,
      customer_phone text,
      equipment_requested text,
      rental_start_date timestamptz,
      rental_end_date timestamptz,
      subtotal numeric(12, 2) not null default 0,
      deposit_amount numeric(12, 2) not null default 0,
      delivery_fee numeric(12, 2) not null default 0,
      tax_amount numeric(12, 2) not null default 0,
      total_amount numeric(12, 2) not null default 0,
      amount_paid numeric(12, 2) not null default 0,
      balance_due numeric(12, 2) not null default 0,
      payment_status text not null default 'unpaid',
      payment_link text,
      notes text,
      issued_at timestamptz,
      due_at timestamptz,
      paid_at timestamptz,
      pdf_url text,
      created_at timestamptz not null,
      updated_at timestamptz not null,
      constraint legacy_invoice_agreement_cascade_fk
        foreign key (rental_agreement_id) references public.rental_agreements(id)
        on delete cascade,
      constraint legacy_invoice_request_set_null_fk
        foreign key (rental_request_id) references public.rental_requests(id)
        on delete set null
    );

    create table public.payments (
      id uuid primary key default gen_random_uuid(),
      invoice_id uuid not null,
      amount numeric(12, 2) not null,
      payment_method text not null,
      reference_number text,
      notes text,
      received_at timestamptz not null default now(),
      created_at timestamptz not null default now(),
      constraint legacy_payment_invoice_cascade_fk
        foreign key (invoice_id) references public.invoices(id)
        on delete cascade
    );
  `);
};

const seedProductionShape = async (database) => {
  await database.query(`
    insert into public.rental_requests (
      id, created_at, updated_at, full_name, phone, email,
      equipment_requested, rental_start_date, rental_end_date,
      agreement_accepted, status, quote_amount
    ) values
      ($1, '2025-01-01T10:00:00Z', '2025-01-01T10:00:00Z',
       'Synthetic Utility History', '5550100001', 'utility-one@example.test',
       'Utility Trailer', '2025-01-10', '2025-01-12', true, 'completed', 300),
      ($2, '2025-02-01T10:00:00Z', '2025-02-01T10:00:00Z',
       'Synthetic Utility Pending', '5550100002', 'utility-two@example.test',
       'Utility Trailer', '2025-02-10', '2025-02-11', true, 'new', 200),
      ($3, '2025-03-01T10:00:00Z', '2025-03-01T10:00:00Z',
       'Synthetic RawMax History', '5550100003', 'rawmax@example.test',
       '2025 RawMax Tilt Deck 22’', '2025-03-10', '2025-03-13',
       true, 'completed', 450)
  `, [requestIds.duplicate, requestIds.noInvoice, requestIds.rawmax]);

  for (let index = 1; index <= 14; index += 1) {
    const id = `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
    await database.query(`
      insert into public.rental_agreements (
        id, rental_request_id, agreement_number, status, customer_name,
        customer_email, customer_phone, equipment_requested,
        rental_start_date, rental_end_date, quote_amount, total_amount,
        clause_snapshot, locked_at, created_at
      ) values (
        $1, $2, $3, 'draft', 'Synthetic Utility History',
        'utility-one@example.test', '5550100001', 'Utility Trailer',
        '2025-01-10', '2025-01-12', 0, 0, null, null, $4
      )
    `, [
      id,
      requestIds.duplicate,
      `LEGACY-DRAFT-${String(index).padStart(3, "0")}`,
      `2025-01-${String(index).padStart(2, "0")}T12:00:00Z`,
    ]);
  }

  const readyAgreements = [
    {
      id: readyAgreementIds.duplicate,
      requestId: requestIds.duplicate,
      number: "LEGACY-READY-015",
      name: "Synthetic Utility History",
      email: "utility-one@example.test",
      equipment: "Utility Trailer",
      start: "2025-01-10",
      end: "2025-01-12",
      total: 300,
      createdAt: "2025-01-15T12:00:00Z",
      lockedAt: "2025-01-16T12:00:00Z",
    },
    {
      id: readyAgreementIds.noInvoice,
      requestId: requestIds.noInvoice,
      number: "LEGACY-READY-016",
      name: "Synthetic Utility Pending",
      email: "utility-two@example.test",
      equipment: "Utility Trailer",
      start: "2025-02-10",
      end: "2025-02-11",
      total: 200,
      createdAt: "2025-02-01T12:00:00Z",
      lockedAt: "2025-02-02T12:00:00Z",
    },
    {
      id: readyAgreementIds.rawmax,
      requestId: requestIds.rawmax,
      number: "LEGACY-READY-017",
      name: "Synthetic RawMax History",
      email: "rawmax@example.test",
      equipment: "2025 RawMax Tilt Deck 22’",
      start: "2025-03-10",
      end: "2025-03-13",
      total: 450,
      createdAt: "2025-03-01T12:00:00Z",
      lockedAt: "2025-03-02T12:00:00Z",
    },
  ];

  for (const agreement of readyAgreements) {
    await database.query(`
      insert into public.rental_agreements (
        id, rental_request_id, agreement_number, status, customer_name,
        customer_email, customer_phone, equipment_requested,
        rental_start_date, rental_end_date, quote_amount, total_amount,
        clause_snapshot, locked_at, created_at
      ) values (
        $1, $2, $3, 'ready', $4, $5, '5550100099', $6,
        $7, $8, $9, $9,
        '[{"id":"legacy-clause","title":"Stored Legacy Terms","body":"Historical wording","display_order":0}]'::jsonb,
        $10, $11
      )
    `, [
      agreement.id,
      agreement.requestId,
      agreement.number,
      agreement.name,
      agreement.email,
      agreement.equipment,
      agreement.start,
      agreement.end,
      agreement.total,
      agreement.lockedAt,
      agreement.createdAt,
    ]);
  }

  await database.query(`
    insert into public.invoices (
      id, rental_agreement_id, rental_request_id, invoice_number, status,
      customer_name, customer_email, equipment_requested,
      rental_start_date, rental_end_date, subtotal, total_amount,
      deposit_amount, delivery_fee, tax_amount, amount_paid, balance_due,
      payment_status, issued_at, created_at, updated_at
    ) values
      ($1, $2, $3, 'LEGACY-INVOICE-001', 'issued',
       'Synthetic Utility History', 'utility-one@example.test', 'Utility Trailer',
       '2025-01-10T00:00:00Z', '2025-01-12T00:00:00Z',
       200, 340, 100, 30, 10, 0, 340, 'unpaid', '2025-01-16T13:00:00Z',
       '2025-01-16T13:00:00Z', '2025-01-16T13:00:00Z'),
      ($4, $5, $6, 'LEGACY-INVOICE-002', 'issued',
       'Synthetic RawMax History', 'rawmax@example.test',
       '2025 RawMax Tilt Deck 22’',
       '2025-03-10T00:00:00Z', '2025-03-13T00:00:00Z',
       100, 149.95, 49.95, 0, 0, 0, 149.95, 'unpaid', '2025-03-02T13:00:00Z',
       '2025-03-02T13:00:00Z', '2025-03-02T13:00:00Z')
  `, [
    invoiceIds[0],
    readyAgreementIds.duplicate,
    requestIds.duplicate,
    invoiceIds[1],
    readyAgreementIds.rawmax,
    requestIds.rawmax,
  ]);
};

const historicalSnapshot = (database) => database.query(`
  select jsonb_build_object(
    'requests', (
      select jsonb_agg(jsonb_build_object(
        'id', id, 'created_at', created_at, 'updated_at', updated_at,
        'equipment_requested', equipment_requested, 'status', status,
        'quote_amount', quote_amount
      ) order by id)
      from public.rental_requests
      where id in ($1, $2, $3)
    ),
    'agreements', (
      select jsonb_agg(jsonb_build_object(
        'id', id, 'rental_request_id', rental_request_id,
        'agreement_number', agreement_number, 'status', status,
        'equipment_requested', equipment_requested,
        'quote_amount', quote_amount, 'total_amount', total_amount,
        'signed_at', signed_at, 'locked_at', locked_at,
        'created_at', created_at, 'clause_snapshot', clause_snapshot
      ) order by id)
      from public.rental_agreements
      where rental_request_id in ($1, $2, $3)
    ),
    'invoices', (
      select jsonb_agg(jsonb_build_object(
        'id', id, 'rental_agreement_id', rental_agreement_id,
        'rental_request_id', rental_request_id,
        'invoice_number', invoice_number, 'status', status,
        'equipment_requested', equipment_requested,
        'rental_start_date', rental_start_date,
        'rental_end_date', rental_end_date,
        'subtotal', subtotal, 'deposit_amount', deposit_amount,
        'delivery_fee', delivery_fee, 'tax_amount', tax_amount,
        'total_amount', total_amount,
        'amount_paid', amount_paid, 'balance_due', balance_due,
        'payment_status', payment_status, 'issued_at', issued_at,
        'created_at', created_at, 'updated_at', updated_at,
        'pdf_url', pdf_url
      ) order by id)
      from public.invoices
      where id in ($4, $5)
    )
  ) as snapshot
`, [
  requestIds.duplicate,
  requestIds.noInvoice,
  requestIds.rawmax,
  invoiceIds[0],
  invoiceIds[1],
]);

const exactForeignKeys = (database) => database.query(`
  select source.relname as source_table, source_attribute.attname as source_column,
    target.relname as target_table, target_attribute.attname as target_column,
    constraints.confdeltype as delete_action, constraints.convalidated as validated,
    constraints.conname
  from pg_catalog.pg_constraint constraints
  join pg_catalog.pg_class source on source.oid = constraints.conrelid
  join pg_catalog.pg_namespace source_namespace on source_namespace.oid = source.relnamespace
  join pg_catalog.pg_class target on target.oid = constraints.confrelid
  join pg_catalog.pg_namespace target_namespace on target_namespace.oid = target.relnamespace
  join pg_catalog.pg_attribute source_attribute
    on source_attribute.attrelid = constraints.conrelid
   and source_attribute.attnum = constraints.conkey[1]
  join pg_catalog.pg_attribute target_attribute
    on target_attribute.attrelid = constraints.confrelid
   and target_attribute.attnum = constraints.confkey[1]
  where constraints.contype = 'f'
    and source_namespace.nspname = 'public'
    and target_namespace.nspname = 'public'
    and pg_catalog.cardinality(constraints.conkey) = 1
    and (
      (source.relname = 'rental_agreements' and source_attribute.attname = 'rental_request_id'
        and target.relname = 'rental_requests' and target_attribute.attname = 'id')
      or (source.relname = 'invoices' and source_attribute.attname = 'rental_agreement_id'
        and target.relname = 'rental_agreements' and target_attribute.attname = 'id')
      or (source.relname = 'invoices' and source_attribute.attname = 'rental_request_id'
        and target.relname = 'rental_requests' and target_attribute.attname = 'id')
      or (source.relname = 'payments' and source_attribute.attname = 'invoice_id'
        and target.relname = 'invoices' and target_attribute.attname = 'id')
      or (source.relname = 'rental_request_items' and source_attribute.attname = 'rental_request_id'
        and target.relname = 'rental_requests' and target_attribute.attname = 'id')
    )
  order by source.relname, source_attribute.attname
`);

const setStaffRole = async (database) => {
  await database.exec("set role authenticated");
  await database.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({
      role: "authenticated",
      app_metadata: { role: "staff" },
      sub: "90000000-0000-4000-8000-000000000001",
    }),
  ]);
};

const resetRole = async (database) => {
  await database.exec("reset role");
  await database.query("select set_config('request.jwt.claims', '', false)");
};

test("production-shaped legacy data survives the complete fresh migration path", async (t) => {
  const database = await createDatabase();
  t.after(() => database.close());

  await applyMigrations(database, 0, 2);
  await createLegacyProductionTables(database);
  await seedProductionShape(database);

  const before = (await historicalSnapshot(database)).rows[0].snapshot;
  const legacyForeignKeys = await exactForeignKeys(database);
  assert.deepEqual(
    legacyForeignKeys.rows.map((row) => row.delete_action).sort(),
    ["c", "c", "c", "n", "r"]
  );

  await applyMigrations(database, 2);

  const after = (await historicalSnapshot(database)).rows[0].snapshot;
  assert.deepEqual(after, before);

  const preservedFinancials = await database.query(`
    select invoice_number, subtotal::text, deposit_amount::text,
      delivery_fee::text, tax_amount::text, total_amount::text,
      amount_paid::text, balance_due::text, payment_status, status,
      issued_at is not null as has_issued_at
    from public.invoices
    where id in ($1, $2)
    order by invoice_number
  `, invoiceIds);
  assert.deepEqual(preservedFinancials.rows, [
    {
      invoice_number: "LEGACY-INVOICE-001",
      subtotal: "200.00",
      deposit_amount: "100.00",
      delivery_fee: "30.00",
      tax_amount: "10.00",
      total_amount: "340.00",
      amount_paid: "0.00",
      balance_due: "340.00",
      payment_status: "unpaid",
      status: "issued",
      has_issued_at: true,
    },
    {
      invoice_number: "LEGACY-INVOICE-002",
      subtotal: "100.00",
      deposit_amount: "49.95",
      delivery_fee: "0.00",
      tax_amount: "0.00",
      total_amount: "149.95",
      amount_paid: "0.00",
      balance_due: "149.95",
      payment_status: "unpaid",
      status: "issued",
      has_issued_at: true,
    },
  ]);

  const counts = await database.query(`
    select
      (select count(*)::integer from public.rental_requests
       where id in ($1, $2, $3)) as requests,
      (select count(*)::integer from public.rental_agreements
       where rental_request_id in ($1, $2, $3)) as agreements,
      (select count(*)::integer from public.rental_agreements
       where rental_request_id = $1 and status = 'draft') as duplicate_drafts,
      (select count(*)::integer from public.rental_agreements
       where rental_request_id in ($1, $2, $3)
         and status = 'ready' and locked_at is not null) as ready_locked,
      (select count(*)::integer from public.invoices
       where id in ($4, $5)) as invoices,
      (select count(*)::integer from public.payments) as payments,
      (select count(*)::integer from public.agreement_items
       where rental_agreement_id in (
         select id from public.rental_agreements
         where rental_request_id in ($1, $2, $3)
       )) as agreement_items,
      (select count(*)::integer from public.invoice_items
       where invoice_id in ($4, $5)) as invoice_items,
      (select count(*)::integer from public.rental_documents
       where rental_request_id in ($1, $2, $3)) as documents,
      (select count(*)::integer from public.rental_availability_checks
       where rental_request_id in ($1, $2, $3)) as availability_checks,
      (select count(*)::integer from public.rental_approval_events
       where rental_request_id in ($1, $2, $3)) as approval_events
  `, [
    requestIds.duplicate,
    requestIds.noInvoice,
    requestIds.rawmax,
    invoiceIds[0],
    invoiceIds[1],
  ]);
  assert.deepEqual(counts.rows[0], {
    requests: 3,
    agreements: 17,
    duplicate_drafts: 14,
    ready_locked: 3,
    invoices: 2,
    payments: 0,
    agreement_items: 0,
    invoice_items: 0,
    documents: 0,
    availability_checks: 0,
    approval_events: 0,
  });

  const legacyIntegrity = await database.query(`
    select id, snapshot_schema_version, current_snapshot_hash,
      accepted_snapshot_hash, credit_card_authorization_terms,
      acceptance_acknowledged, signature_status, signed_at
    from public.rental_agreements
    where id in ($1, $2, $3)
    order by id
  `, [
    readyAgreementIds.duplicate,
    readyAgreementIds.noInvoice,
    readyAgreementIds.rawmax,
  ]);
  for (const row of legacyIntegrity.rows) {
    assert.equal(row.snapshot_schema_version, null);
    assert.equal(row.current_snapshot_hash, null);
    assert.equal(row.accepted_snapshot_hash, null);
    assert.equal(row.credit_card_authorization_terms, null);
    assert.equal(row.acceptance_acknowledged, false);
    assert.equal(row.signature_status, "pending");
    assert.equal(row.signed_at, null);
  }

  assert.equal(
    (await database.query(
      "select count(*)::integer as count from public.invoices where rental_agreement_id = $1",
      [readyAgreementIds.noInvoice]
    )).rows[0].count,
    0
  );

  const canonical = await database.query(
    "select private.canonical_rental_agreement_id($1::uuid) as id",
    [requestIds.duplicate]
  );
  assert.equal(canonical.rows[0].id, readyAgreementIds.duplicate);

  const finalForeignKeys = await exactForeignKeys(database);
  assert.equal(finalForeignKeys.rows.length, 5);
  for (const row of finalForeignKeys.rows) {
    assert.equal(row.delete_action, "r");
    assert.equal(row.validated, true);
  }

  const archivedHistory = await database.query(`
    select
      (select count(*)::integer from public.rental_agreements
       where equipment_requested = 'Utility Trailer') as utility_agreements,
      (select count(*)::integer from public.rental_agreements
       where equipment_requested = '2025 RawMax Tilt Deck 22’') as rawmax_agreements,
      (select count(*)::integer from public.invoices
       where equipment_requested in ('Utility Trailer', '2025 RawMax Tilt Deck 22’')) as archived_invoices,
      (select count(*)::integer from private.rental_equipment_catalog
       where equipment_id in ('utility-trailer', 'rawmax-tilt-deck-22')
         and status = 'archived' and rentable is false) as archived_catalog
  `);
  assert.deepEqual(archivedHistory.rows[0], {
    utility_agreements: 16,
    rawmax_agreements: 1,
    archived_invoices: 2,
    archived_catalog: 2,
  });
});

test("canonical fallback and authoritative creation reject duplicate attempts under embedded local execution", async (t) => {
  const database = await createDatabase();
  t.after(() => database.close());
  await applyMigrations(database, 0);

  const draftOnlyRequest = "10000000-0000-4000-8000-000000000010";
  await database.query(`
    insert into public.rental_requests (
      id, full_name, phone, email, equipment_requested,
      rental_start_date, rental_end_date, agreement_accepted
    ) values ($1, 'Draft Fallback', '5550100010', 'draft-fallback@example.test',
      'Utility Trailer', current_date + 10, current_date + 11, true)
  `, [draftOnlyRequest]);
  await database.query(`
    insert into public.rental_agreements (
      id, rental_request_id, agreement_number, status, customer_name,
      customer_email, customer_phone, equipment_requested,
      rental_start_date, rental_end_date, quote_amount, total_amount,
      snapshot_schema_version, created_at
    ) values
      ('20000000-0000-4000-8000-000000000101', $1, 'LEGACY-FALLBACK-OLD',
       'draft', 'Draft Fallback', 'draft-fallback@example.test', '5550100010',
       'Utility Trailer', current_date + 10, current_date + 11, 100, 100,
       null, '2025-01-01T00:00:00Z'),
      ('20000000-0000-4000-8000-000000000102', $1, 'LEGACY-FALLBACK-NEW',
       'draft', 'Draft Fallback', 'draft-fallback@example.test', '5550100010',
       'Utility Trailer', current_date + 10, current_date + 11, 100, 100,
       null, '2025-01-02T00:00:00Z')
  `, [draftOnlyRequest]);

  assert.equal(
    (await database.query(
      "select private.canonical_rental_agreement_id($1::uuid) as id",
      [draftOnlyRequest]
    )).rows[0].id,
    "20000000-0000-4000-8000-000000000102"
  );

  const releaseRequest = "10000000-0000-4000-8000-000000000011";
  await database.query(`
    insert into public.rental_requests (
      id, full_name, phone, email, equipment_requested,
      rental_start_date, rental_end_date, rental_duration,
      agreement_accepted, status, quote_amount,
      availability_status, insurance_verification_status
    ) values (
      $1, 'Release 1 Creation', '5550100011', 'release1-create@example.test',
      'Historical Manual Item', current_date + 20, current_date + 21,
      '1 day', true, 'new', 125, 'available', 'verified'
    )
  `, [releaseRequest]);
  await database.exec(`
    insert into public.agreement_clauses (
      clause_key, title, body, display_order, enabled, category, version
    ) values (
      'production-compatibility', 'Compatibility Terms',
      'Synthetic Release 1 compatibility terms.', 0, true, 'general', 1
    );
  `);

  await setStaffRole(database);
  const attempts = await Promise.allSettled([
    database.query(
      "select public.create_rental_agreement_for_request($1::uuid) as id",
      [releaseRequest]
    ),
    database.query(
      "select public.create_rental_agreement_for_request($1::uuid) as id",
      [releaseRequest]
    ),
  ]);
  await resetRole(database);

  assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
  assert.equal(attempts.filter((attempt) => attempt.status === "rejected").length, 1);
  const created = await database.query(`
    select count(*)::integer as count,
      min(snapshot_schema_version)::integer as snapshot_schema_version
    from public.rental_agreements where rental_request_id = $1
  `, [releaseRequest]);
  assert.deepEqual(created.rows[0], { count: 1, snapshot_schema_version: 1 });

});

test("already-migrated reconciliation converges, replaces FKs, and advances sequences without regression", async (t) => {
  const database = await createDatabase();
  t.after(() => database.close());
  await applyMigrations(database, 0, migrationUrls.length - 1);

  const requestId = "10000000-0000-4000-8000-000000000020";
  const agreementId = "20000000-0000-4000-8000-000000000020";
  const invoiceId = "30000000-0000-4000-8000-000000000020";
  await database.query(`
    insert into public.rental_requests (
      id, full_name, phone, email, equipment_requested,
      rental_start_date, rental_end_date, agreement_accepted
    ) values ($1, 'Sequence Fixture', '5550100020', 'sequence@example.test',
      'Utility Trailer', current_date + 30, current_date + 31, true)
  `, [requestId]);
  await database.query(`
    insert into public.rental_agreements (
      id, rental_request_id, agreement_number, status, customer_name,
      customer_email, customer_phone, equipment_requested,
      rental_start_date, rental_end_date, quote_amount, total_amount,
      created_at
    ) values (
      $2, $1, 'UCR-2026-000125', 'draft', 'Sequence Fixture',
      'sequence@example.test', '5550100020', 'Utility Trailer',
      current_date + 30, current_date + 31, 100, 100,
      '2026-01-01T00:00:00Z'
    )
  `, [requestId, agreementId]);
  await database.query(`
    insert into public.invoices (
      id, rental_agreement_id, rental_request_id, invoice_number,
      invoice_type, status, customer_name, equipment_requested,
      subtotal, total_amount, amount_paid, balance_due, payment_status
    ) values (
      $3, $2, $1, 'INV-2026-000075', 'original_rental', 'draft',
      'Sequence Fixture', 'Utility Trailer', 100, 100, 0, 100, 'unpaid'
    )
  `, [requestId, agreementId, invoiceId]);

  await database.exec(`
    drop index if exists public.rental_agreements_canonical_request_key;
    drop index if exists public.rental_agreements_release1_request_key;
    create unique index rental_agreements_rental_request_key
      on public.rental_agreements (rental_request_id);

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
      agreement_record public.rental_agreements%rowtype;
    begin
      select * into agreement_record
      from public.rental_agreements
      where rental_request_id = target_rental_request_id;

      return pg_catalog.jsonb_build_object(
        'agreementId', agreement_record.id,
        'selection', 'old-preview-request-level'
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
      agreement_record public.rental_agreements%rowtype;
    begin
      select * into agreement_record
      from public.rental_agreements
      where rental_request_id = target_rental_request_id
      for update;

      return pg_catalog.jsonb_build_object(
        'agreementId', agreement_record.id,
        'selection', 'old-preview-request-level',
        'note', note_value
      );
    end;
    $$;

    drop function private.canonical_rental_agreement_id(uuid);

    alter table public.rental_agreements
      drop constraint rental_agreements_rental_request_fk;
    alter table public.invoices
      drop constraint invoices_rental_agreement_fk;
    alter table public.invoices
      drop constraint invoices_rental_request_fk;
    alter table public.payments
      drop constraint payments_invoice_fk;

    alter table public.rental_agreements
      add constraint preview_legacy_agreement_cascade_fk
      foreign key (rental_request_id) references public.rental_requests(id)
      on delete cascade;
    alter table public.invoices
      add constraint preview_legacy_invoice_agreement_cascade_fk
      foreign key (rental_agreement_id) references public.rental_agreements(id)
      on delete cascade;
    alter table public.invoices
      add constraint preview_legacy_invoice_request_set_null_fk
      foreign key (rental_request_id) references public.rental_requests(id)
      on delete set null;
    alter table public.payments
      add constraint preview_legacy_payment_invoice_cascade_fk
      foreign key (invoice_id) references public.invoices(id)
      on delete cascade;
  `);

  const oldPreviewIndexes = await database.query(`
    select indexname, indexdef
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and indexname in (
        'rental_agreements_rental_request_key',
        'rental_agreements_canonical_request_key',
        'rental_agreements_release1_request_key'
      )
    order by indexname
  `);
  assert.deepEqual(
    oldPreviewIndexes.rows.map((row) => row.indexname),
    ["rental_agreements_rental_request_key"]
  );
  assert.doesNotMatch(oldPreviewIndexes.rows[0].indexdef, / where /i);

  assert.equal(
    (await database.query(
      "select pg_catalog.to_regprocedure('private.canonical_rental_agreement_id(uuid)')::text as helper"
    )).rows[0].helper,
    null
  );

  const oldApprovalDefinitions = await database.query(`
    select
      pg_catalog.pg_get_functiondef(
        'private.rental_approval_checklist(uuid)'::pg_catalog.regprocedure
      ) as checklist,
      pg_catalog.pg_get_functiondef(
        'public.approve_rental_request(uuid,text)'::pg_catalog.regprocedure
      ) as approval
  `);
  assert.match(
    oldApprovalDefinitions.rows[0].checklist,
    /where rental_request_id = target_rental_request_id/i
  );
  assert.match(
    oldApprovalDefinitions.rows[0].approval,
    /where rental_request_id = target_rental_request_id[\s\S]*for update/i
  );
  assert.doesNotMatch(
    oldApprovalDefinitions.rows[0].checklist,
    /canonical_rental_agreement_id/i
  );
  assert.doesNotMatch(
    oldApprovalDefinitions.rows[0].approval,
    /canonical_rental_agreement_id/i
  );

  const oldPreviewForeignKeys = await exactForeignKeys(database);
  assert.deepEqual(
    oldPreviewForeignKeys.rows
      .filter((row) => row.source_table !== "rental_request_items")
      .map((row) => ({ name: row.conname, action: row.delete_action })),
    [
      { name: "preview_legacy_invoice_agreement_cascade_fk", action: "c" },
      { name: "preview_legacy_invoice_request_set_null_fk", action: "n" },
      { name: "preview_legacy_payment_invoice_cascade_fk", action: "c" },
      { name: "preview_legacy_agreement_cascade_fk", action: "c" },
    ]
  );

  const reconciliationFixtureSnapshot = async () =>
    (await database.query(`
      select pg_catalog.jsonb_build_object(
        'agreement', pg_catalog.to_jsonb(agreements),
        'invoice', pg_catalog.to_jsonb(invoices)
      ) as snapshot
      from public.rental_agreements agreements
      join public.invoices invoices
        on invoices.rental_agreement_id = agreements.id
      where agreements.id = $1
    `, [agreementId])).rows[0].snapshot;

  const beforeReconciliation = await reconciliationFixtureSnapshot();
  await applyMigration(database, reconciliationUrl);

  const indexes = await database.query(`
    select indexname, indexdef
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and indexname in (
        'rental_agreements_rental_request_key',
        'rental_agreements_canonical_request_key',
        'rental_agreements_release1_request_key'
      )
    order by indexname
  `);
  assert.deepEqual(
    indexes.rows.map((row) => row.indexname),
    [
      "rental_agreements_canonical_request_key",
      "rental_agreements_release1_request_key",
    ]
  );
  assert.match(
    indexes.rows.find((row) =>
      row.indexname === "rental_agreements_canonical_request_key"
    ).indexdef,
    /where[\s\S]*status[\s\S]*sent[\s\S]*viewed[\s\S]*ready[\s\S]*signed/i
  );
  assert.match(
    indexes.rows.find((row) =>
      row.indexname === "rental_agreements_release1_request_key"
    ).indexdef,
    /where[\s\S]*snapshot_schema_version[\s\S]*=[\s\S]*1[\s\S]*status[\s\S]*<>[\s\S]*cancelled/i
  );

  assert.equal(
    (await database.query(
      "select pg_catalog.to_regprocedure('private.canonical_rental_agreement_id(uuid)') is not null as exists"
    )).rows[0].exists,
    true
  );
  const reconciledApprovalDefinitions = await database.query(`
    select
      pg_catalog.pg_get_functiondef(
        'private.rental_approval_checklist(uuid)'::pg_catalog.regprocedure
      ) as checklist,
      pg_catalog.pg_get_functiondef(
        'public.approve_rental_request(uuid,text)'::pg_catalog.regprocedure
      ) as approval
  `);
  assert.match(
    reconciledApprovalDefinitions.rows[0].checklist,
    /canonical_rental_agreement_id\(target_rental_request_id\)/i
  );
  assert.match(
    reconciledApprovalDefinitions.rows[0].approval,
    /canonical_rental_agreement_id\(target_rental_request_id\)[\s\S]*for update/i
  );

  const finalForeignKeys = await exactForeignKeys(database);
  assert.equal(finalForeignKeys.rows.length, 5);
  for (const row of finalForeignKeys.rows) {
    assert.equal(row.delete_action, "r");
    assert.equal(row.validated, true);
  }
  assert.deepEqual(await reconciliationFixtureSnapshot(), beforeReconciliation);

  await applyMigration(database, reconciliationUrl);
  assert.deepEqual(await reconciliationFixtureSnapshot(), beforeReconciliation);

  assert.equal(
    (await database.query("select nextval('public.rental_agreement_number_seq') as value")).rows[0].value,
    126
  );
  assert.equal(
    (await database.query("select nextval('public.invoice_number_seq') as value")).rows[0].value,
    76
  );

  await applyMigration(database, reconciliationUrl);
  assert.equal(
    (await database.query("select nextval('public.rental_agreement_number_seq') as value")).rows[0].value,
    127
  );
  assert.equal(
    (await database.query("select nextval('public.invoice_number_seq') as value")).rows[0].value,
    77
  );

  const preserved = await database.query(`
    select agreements.agreement_number, invoices.invoice_number,
      agreements.rental_request_id as agreement_request_id,
      invoices.rental_agreement_id,
      invoices.rental_request_id as invoice_request_id
    from public.rental_agreements agreements
    join public.invoices invoices on invoices.rental_agreement_id = agreements.id
    where agreements.id = $1
  `, [agreementId]);
  assert.deepEqual(preserved.rows[0], {
    agreement_number: "UCR-2026-000125",
    invoice_number: "INV-2026-000075",
    agreement_request_id: requestId,
    rental_agreement_id: agreementId,
    invoice_request_id: requestId,
  });
});
