import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const approvalMigrationUrl = new URL(
  "../../supabase/migrations/20260808000100_rental_approval_workflow.sql",
  import.meta.url
);
const migrationUrls = [
  new URL("../../supabase/migrations/20260805000000_rental_requests_compatibility_baseline.sql", import.meta.url),
  new URL("../../supabase/migrations/20260805000100_rental_request_items_persistence.sql", import.meta.url),
  new URL("../../supabase/migrations/20260805000200_rental_agreement_snapshot_persistence.sql", import.meta.url),
  new URL("../../supabase/migrations/20260806000100_agreement_legal_integrity_remediation.sql", import.meta.url),
  new URL("../../supabase/migrations/20260806000200_immutable_multi_item_invoice_persistence.sql", import.meta.url),
  new URL("../../supabase/migrations/20260806000300_invoice_snapshot_integrity_remediation.sql", import.meta.url),
  new URL("../../supabase/migrations/20260807000100_private_rental_document_workflow.sql", import.meta.url),
  approvalMigrationUrl,
  new URL("../../supabase/migrations/20260809000100_release1_production_shape_reconciliation.sql", import.meta.url),
  new URL("../../supabase/migrations/20260810000100_utah_driver_license_verification.sql", import.meta.url),
];
const adminDashboardUrl = new URL(
  "../../src/pages/AdminDashboardPage.tsx",
  import.meta.url
);

const staffId = "10000000-0000-4000-8000-000000000001";
const adminId = "10000000-0000-4000-8000-000000000002";

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
  for (const migrationUrl of migrationUrls) {
    await database.exec(await readFile(migrationUrl, "utf8"));
  }
  await database.exec(`
    update private.release_feature_flags
    set enabled = true
    where feature_key = 'multi_item_rental_requests';

    insert into public.agreement_clauses (
      clause_key, title, body, display_order, enabled, category, version
    ) values (
      'approval-test-terms', 'Approval Test Terms',
      'The renter accepts the Release 1 Approval workflow test terms.',
      0, true, 'general', 1
    );
  `);
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

const asStaff = (database, actorId = staffId, role = "staff") =>
  setRole(database, "authenticated", {
    sub: actorId,
    app_metadata: role === "admin" ? { app_role: "admin" } : { role: "staff" },
  });

const expectDatabaseError = async (operation, expectedText) => {
  await assert.rejects(operation, (error) => {
    assert.match(error.message, new RegExp(expectedText, "i"));
    return true;
  });
};

const isoDaysFromNow = (days) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(16, 0, 0, 0);
  return date.toISOString();
};

const equipment = {
  bobcat: "bobcat-t550-skid-steer",
  roller: "wacker-rd12-roller",
};

const item = (equipmentId, startDay, endDay, notes = null) => ({
  equipment_id: equipmentId,
  start_date: isoDaysFromNow(startDay),
  end_date: isoDaysFromNow(endDay),
  quantity: 1,
  notes,
});

const createRequest = async (database, label, rentalItem) => {
  await setRole(database, "anon");
  const result = await database.query(
    "select public.create_rental_request_with_items($1::jsonb, $2::jsonb) as id",
    [
      JSON.stringify({
        customer_type: "business",
        business_name: `${label} Test Company`,
        full_name: `${label} Representative`,
        phone: "8015550100",
        email: `${label.toLowerCase().replaceAll(" ", "-")}@example.test`,
        fulfillment_type: "Pickup",
        project_type: "Approval workflow validation",
        notes: "Synthetic test record",
        agreement_accepted: true,
      }),
      JSON.stringify([rentalItem]),
    ]
  );
  await resetRole(database);
  return result.rows[0].id;
};

const getChecklist = async (database, requestId) => {
  await asStaff(database);
  const result = await database.query(
    "select public.get_rental_approval_checklist($1::uuid) as checklist",
    [requestId]
  );
  await resetRole(database);
  return result.rows[0].checklist;
};

const callStaffRpc = async (database, sql, parameters, actorId = staffId, role = "staff") => {
  await asStaff(database, actorId, role);
  const result = await database.query(sql, parameters);
  await resetRole(database);
  return result;
};

const confirmInitial = (database, requestId, note = null, actorId = staffId, role = "staff") =>
  callStaffRpc(
    database,
    "select public.confirm_rental_request_initial_availability($1::uuid, $2::text) as result",
    [requestId, note],
    actorId,
    role
  ).then((result) => result.rows[0].result);

const registerDocument = async (database, requestId, documentType) => {
  const objectId = randomUUID();
  const path = `${requestId}/${documentType}/${objectId}.pdf`;
  await database.query(
    `insert into storage.objects (bucket_id, name, metadata)
     values ('rental-documents', $1, '{"size":5,"mimetype":"application/pdf"}'::jsonb)`,
    [path]
  );
  const result = await callStaffRpc(
    database,
    `select public.register_rental_document(
      $1::uuid, $2::text, 'rental-documents', $3::text,
      $4::text, 'application/pdf', 5::bigint
    ) as id`,
    [requestId, documentType, path, `${documentType}.pdf`]
  );
  return result.rows[0].id;
};

const prepareDocuments = async (database, requestId) => {
  const driverLicenseId = await registerDocument(database, requestId, "driver_license");
  await callStaffRpc(
    database,
    "select public.review_rental_driver_license($1::uuid, $2::uuid, 'verified', 'ut', 'Utah license manually reviewed')",
    [requestId, driverLicenseId]
  );
  await registerDocument(database, requestId, "insurance");
  await callStaffRpc(
    database,
    "select public.review_rental_insurance($1::uuid, 'verified', 'Current coverage verified')",
    [requestId]
  );
};

const createAgreement = async (database, requestId, depositAmount = 0) => {
  const created = await callStaffRpc(
    database,
    "select public.create_rental_agreement_for_request($1::uuid) as id",
    [requestId]
  );
  const agreementId = created.rows[0].id;
  if (depositAmount > 0) {
    await callStaffRpc(
      database,
      "select public.update_rental_agreement_financials($1::uuid, $2::numeric, 0, 0)",
      [agreementId, depositAmount]
    );
  }
  return agreementId;
};

const acceptAndFinalizeAgreement = async (database, agreementId) => {
  await callStaffRpc(
    database,
    `select public.record_rental_agreement_acceptance(
      $1::uuid, 'Approval Test Signer', 'Authorized Representative', true, true
    )`,
    [agreementId]
  );
  await callStaffRpc(
    database,
    "select public.finalize_rental_agreement($1::uuid)",
    [agreementId]
  );
};

const createInvoice = async (database, agreementId) => {
  const result = await callStaffRpc(
    database,
    "select public.create_invoice_for_agreement($1::uuid) as id",
    [agreementId]
  );
  return result.rows[0].id;
};

const prepareApprovalCandidate = async (
  database,
  { label, rentalItem, depositAmount = 0, finalize = true }
) => {
  const requestId = await createRequest(database, label, rentalItem);
  await prepareDocuments(database, requestId);
  const initial = await confirmInitial(database, requestId);
  assert.equal(initial.confirmed, true);
  const agreementId = await createAgreement(database, requestId, depositAmount);
  if (!finalize) return { requestId, agreementId, invoiceId: null };
  await acceptAndFinalizeAgreement(database, agreementId);
  const invoiceId = await createInvoice(database, agreementId);
  return { requestId, agreementId, invoiceId };
};

const issueInvoice = (database, invoiceId) =>
  callStaffRpc(database, "select public.issue_invoice($1::uuid)", [invoiceId]);

const recordPayment = (database, invoiceId, amount) =>
  callStaffRpc(
    database,
    `select public.record_invoice_payment(
      $1::uuid, $2::numeric, 'card', 'approval-test', 'Approval gate test'
    )`,
    [invoiceId, amount]
  );

const configurePaymentPolicy = (database, policy) =>
  database.query(
    `update private.rental_approval_configuration
     set configuration_value = $1, updated_at = now()
     where configuration_key = 'payment_policy'`,
    [policy]
  );

const approve = (database, requestId, actorId = staffId, role = "staff") =>
  callStaffRpc(
    database,
    "select public.approve_rental_request($1::uuid, 'Approval test') as result",
    [requestId],
    actorId,
    role
  ).then((result) => result.rows[0].result);

const reverse = (database, requestId, actorId = staffId, role = "staff") =>
  callStaffRpc(
    database,
    "select public.reverse_rental_approval($1::uuid, 'Operational reversal') as result",
    [requestId],
    actorId,
    role
  ).then((result) => result.rows[0].result);

const legacyHasConflict = async (
  database,
  equipmentName,
  startDate,
  endDate
) => {
  await setRole(database, "anon");
  const result = await database.query(
    `select public.has_rental_request_conflict(
      $1::text, $2::timestamptz, $3::timestamptz
    ) as conflict`,
    [equipmentName, startDate, endDate]
  );
  await resetRole(database);
  return result.rows[0].conflict;
};

test("rental requests must be inserted with neutral Approval state", async (t) => {
  const database = await createDatabase();
  t.after(() => database.close());

  await expectDatabaseError(
    () => database.query(
      `insert into public.rental_requests (
        full_name, phone, email, equipment_requested, agreement_accepted,
        approval_status, approved_by, approved_at
      ) values (
        'Fabricated Approval', '8015550199', 'fabricated@example.test',
        'Fabricated equipment', true, 'approved', $1, now()
      )`,
      [staffId]
    ),
    "neutral pending Approval state"
  );

  await expectDatabaseError(
    () => database.query(
      `insert into public.rental_requests (
        full_name, phone, email, equipment_requested, agreement_accepted,
        approval_status, approved_by
      ) values (
        'Fabricated Actor', '8015550198', 'fabricated-actor@example.test',
        'Fabricated equipment', true, 'pending', $1
      )`,
      [staffId]
    ),
    "neutral pending Approval state"
  );

  const neutral = await database.query(`
    insert into public.rental_requests (
      full_name, phone, email, equipment_requested, agreement_accepted
    ) values (
      'Neutral Approval', '8015550197', 'neutral@example.test',
      'Neutral equipment', true
    ) returning id, approval_status, approved_by, approved_at
  `);
  assert.deepEqual(neutral.rows[0], {
    id: neutral.rows[0].id,
    approval_status: "pending",
    approved_by: null,
    approved_at: null,
  });

  const normalRequestId = await createRequest(
    database,
    "Normal Request Compatibility",
    item(equipment.bobcat, 5, 6)
  );
  assert.ok(normalRequestId);
  assert.equal(
    Number((await database.query(
      "select count(*) as count from public.rental_approval_events"
    )).rows[0].count),
    0
  );

  const privileges = await database.query(`
    select
      has_table_privilege(
        'service_role', 'public.rental_requests', 'insert'
      ) as service_request_insert,
      has_table_privilege(
        'service_role', 'private.rental_approval_configuration', 'update'
      ) as service_policy_update
  `);
  assert.deepEqual(privileges.rows[0], {
    service_request_insert: false,
    service_policy_update: false,
  });
});

test("Approval checklist is server-derived, authorized, and invalidates stale schedules", async (t) => {
  const database = await createDatabase();
  t.after(() => database.close());
  const requestId = await createRequest(
    database,
    "Checklist",
    item(equipment.bobcat, 10, 12)
  );

  await setRole(database, "anon");
  await expectDatabaseError(
    () => database.query("select public.get_rental_approval_checklist($1::uuid)", [requestId]),
    "Staff authorization|permission denied"
  );
  await expectDatabaseError(
    () => database.query("select public.approve_rental_request($1::uuid, null)", [requestId]),
    "Staff authorization|permission denied"
  );
  await expectDatabaseError(
    () => database.query("select public.reverse_rental_approval($1::uuid, null)", [requestId]),
    "Staff authorization|permission denied"
  );
  await resetRole(database);

  await setRole(database, "authenticated", {
    sub: staffId,
    user_metadata: { role: "staff" },
    app_metadata: { role: "customer" },
  });
  await expectDatabaseError(
    () => database.query(
      "select public.confirm_rental_request_initial_availability($1::uuid, null)",
      [requestId]
    ),
    "Staff authorization"
  );
  await expectDatabaseError(
    () => database.query("select public.approve_rental_request($1::uuid, null)", [requestId]),
    "Staff authorization"
  );
  await expectDatabaseError(
    () => database.query("select public.reverse_rental_approval($1::uuid, null)", [requestId]),
    "Staff authorization"
  );
  await resetRole(database);

  let checklist = await getChecklist(database, requestId);
  assert.equal(checklist.checks.item_data_complete.state, "pass");
  assert.equal(checklist.checks.initial_availability.state, "pending");
  assert.equal(checklist.checks.driver_license.state, "fail");
  assert.equal(checklist.checks.driver_license_verification.state, "pending");
  assert.equal(checklist.checks.insurance.state, "fail");
  assert.equal(checklist.checks.agreement_final.state, "fail");
  assert.equal(checklist.checks.payment_requirement.state, "configuration_required");

  const firstCheck = await confirmInitial(database, requestId);
  assert.equal(firstCheck.confirmed, true);
  checklist = firstCheck.checklist;
  assert.equal(checklist.checks.initial_availability.state, "pass");

  await callStaffRpc(
    database,
    "select public.replace_rental_request_items($1::uuid, $2::jsonb, '{}'::jsonb)",
    [requestId, JSON.stringify([item(equipment.bobcat, 11, 13)])]
  );
  checklist = await getChecklist(database, requestId);
  assert.equal(checklist.checks.initial_availability.state, "stale");
  assert.match(checklist.checks.initial_availability.reason, /stale/i);

  const secondCheck = await confirmInitial(database, requestId, "Schedule reviewed again");
  assert.equal(secondCheck.checklist.checks.initial_availability.state, "pass");
  assert.equal(
    Number((await database.query(
      "select count(*) as count from public.rental_availability_checks where rental_request_id = $1",
      [requestId]
    )).rows[0].count),
    2
  );

  const driverLicenseId = await registerDocument(database, requestId, "driver_license");
  await registerDocument(database, requestId, "insurance");
  checklist = await getChecklist(database, requestId);
  assert.equal(checklist.checks.driver_license.state, "pass");
  assert.equal(checklist.checks.driver_license_verification.state, "pending");
  assert.equal(checklist.checks.insurance.state, "pass");
  assert.equal(checklist.checks.insurance_verification.state, "fail");

  await callStaffRpc(
    database,
    "select public.review_rental_insurance($1::uuid, 'rejected', 'Coverage rejected')",
    [requestId]
  );
  checklist = await getChecklist(database, requestId);
  assert.equal(checklist.checks.insurance_verification.state, "fail");

  await callStaffRpc(
    database,
    "select public.review_rental_insurance($1::uuid, 'verified', 'Coverage verified')",
    [requestId]
  );
  checklist = await getChecklist(database, requestId);
  assert.equal(checklist.checks.insurance_verification.state, "pass");

  await callStaffRpc(
    database,
    "select public.review_rental_driver_license($1::uuid, $2::uuid, 'verified', 'ut', 'Utah license reviewed')",
    [requestId, driverLicenseId]
  );
  checklist = await getChecklist(database, requestId);
  assert.equal(checklist.checks.driver_license_verification.state, "pass");

  await registerDocument(database, requestId, "insurance");
  checklist = await getChecklist(database, requestId);
  assert.equal(checklist.checks.insurance_verification.state, "fail");

  await expectDatabaseError(
    () => database.query(
      `insert into public.rental_availability_checks (
        rental_request_id, check_type, schedule_hash, result, checked_by
      ) values ($1, 'initial', $2, 'available', $3)`,
      [requestId, checklist.scheduleHash, staffId]
    ),
    "trusted Approval workflow"
  );

  await expectDatabaseError(
    () => database.query(
      "update public.rental_availability_checks set note = 'tampered' where rental_request_id = $1",
      [requestId]
    ),
    "append-only"
  );

  const legacy = await database.query(`
    insert into public.rental_requests (
      full_name, phone, email, equipment_requested, rental_start_date,
      rental_end_date, agreement_accepted
    ) values (
      'Legacy Approval Test', '8015550101', 'legacy@example.test',
      'Legacy equipment', current_date + 5, current_date + 6, true
    ) returning id
  `);
  checklist = await getChecklist(database, legacy.rows[0].id);
  assert.equal(checklist.checks.item_data_complete.state, "fail");
});

test("Payment policy fails closed and Approval/reversal history is append-only", async (t) => {
  const database = await createDatabase();
  t.after(() => database.close());
  const fixture = await prepareApprovalCandidate(database, {
    label: "Approval Audit",
    rentalItem: item(equipment.roller, 20, 22),
    depositAmount: 100,
  });

  let checklist = await getChecklist(database, fixture.requestId);
  assert.equal(checklist.checks.payment_requirement.state, "configuration_required");
  await asStaff(database);
  await expectDatabaseError(
    () => database.query("select public.approve_rental_request($1::uuid, null)", [fixture.requestId]),
    "not been configured"
  );
  await resetRole(database);

  for (const authorization of [
    { role: "anon", claims: {} },
    {
      role: "authenticated",
      claims: { sub: staffId, app_metadata: { role: "customer" } },
    },
    {
      role: "authenticated",
      claims: { sub: staffId, app_metadata: { role: "staff" } },
    },
  ]) {
    await setRole(database, authorization.role, authorization.claims);
    await expectDatabaseError(
      () => database.query(`
        update private.rental_approval_configuration
        set configuration_value = 'invoice_paid'
        where configuration_key = 'payment_policy'
      `),
      "permission denied"
    );
    await resetRole(database);
  }

  await configurePaymentPolicy(database, "deposit_required");
  await database.query(
    "update public.rental_requests set payment_status = 'paid', deposit_status = 'paid' where id = $1",
    [fixture.requestId]
  );
  checklist = await getChecklist(database, fixture.requestId);
  assert.equal(checklist.checks.payment_requirement.state, "fail");
  assert.match(checklist.checks.payment_requirement.reason, /issued/i);

  await issueInvoice(database, fixture.invoiceId);
  checklist = await getChecklist(database, fixture.requestId);
  assert.equal(checklist.checks.payment_requirement.state, "fail");
  assert.match(checklist.checks.payment_requirement.reason, /deposit/i);

  await recordPayment(database, fixture.invoiceId, 100);
  checklist = await getChecklist(database, fixture.requestId);
  assert.equal(checklist.checks.payment_requirement.state, "pass");
  assert.equal(checklist.actions.canApprove, true);

  const approved = await approve(database, fixture.requestId);
  assert.equal(approved.approved, true);
  assert.equal(approved.checklist.approvalState, "approved");
  assert.equal(approved.checklist.checks.final_availability.state, "pass");

  const state = await database.query(`
    select approval_status, approved_by, approved_at is not null as approved_at
    from public.rental_requests where id = $1
  `, [fixture.requestId]);
  assert.deepEqual(state.rows[0], {
    approval_status: "approved",
    approved_by: staffId,
    approved_at: true,
  });

  await setRole(database, "authenticated", {
    sub: "20000000-0000-4000-8000-000000000002",
    app_metadata: { role: "customer" },
  });
  assert.equal(
    (await database.query("select id from public.rental_approval_events")).rows.length,
    0
  );
  assert.equal(
    (await database.query("select id from public.rental_availability_checks")).rows.length,
    0
  );
  await resetRole(database);

  await expectDatabaseError(
    () => database.query(
      "update public.rental_requests set approval_status = 'reversed' where id = $1",
      [fixture.requestId]
    ),
    "trusted Approval workflow"
  );
  await expectDatabaseError(
    () => database.query(
      "update public.rental_approval_events set note = 'tampered' where rental_request_id = $1",
      [fixture.requestId]
    ),
    "append-only"
  );
  const finalCheck = await database.query(
    "select id from public.rental_availability_checks where rental_request_id = $1 and check_type = 'final' limit 1",
    [fixture.requestId]
  );
  await expectDatabaseError(
    () => database.query(
      `insert into public.rental_approval_events (
        rental_request_id, event_type, actor_id, availability_check_id
      ) values ($1, 'approved', $2, $3)`,
      [fixture.requestId, staffId, finalCheck.rows[0].id]
    ),
    "trusted Approval workflow"
  );
  await expectDatabaseError(
    () => database.query(
      "delete from public.rental_approval_events where rental_request_id = $1",
      [fixture.requestId]
    ),
    "append-only"
  );

  const protectedCountsBefore = await database.query(`
    select
      (select count(*) from public.rental_agreements where rental_request_id = $1) as agreements,
      (select count(*) from public.invoices where rental_request_id = $1) as invoices,
      (select count(*) from public.payments payments join public.invoices invoices on invoices.id = payments.invoice_id where invoices.rental_request_id = $1) as payments,
      (select count(*) from public.rental_documents where rental_request_id = $1) as documents
  `, [fixture.requestId]);

  const reversed = await reverse(database, fixture.requestId);
  assert.equal(reversed.reversed, true);
  assert.equal(reversed.checklist.approvalState, "reversed");
  assert.equal(reversed.checklist.checks.final_availability.state, "stale");

  const protectedCountsAfter = await database.query(`
    select
      (select count(*) from public.rental_agreements where rental_request_id = $1) as agreements,
      (select count(*) from public.invoices where rental_request_id = $1) as invoices,
      (select count(*) from public.payments payments join public.invoices invoices on invoices.id = payments.invoice_id where invoices.rental_request_id = $1) as payments,
      (select count(*) from public.rental_documents where rental_request_id = $1) as documents
  `, [fixture.requestId]);
  assert.deepEqual(protectedCountsAfter.rows[0], protectedCountsBefore.rows[0]);

  const reapproved = await approve(database, fixture.requestId, adminId, "admin");
  assert.equal(reapproved.approved, true);
  const history = await database.query(`
    select event_type, actor_id, payment_policy
    from public.rental_approval_events
    where rental_request_id = $1
    order by occurred_at, id
  `, [fixture.requestId]);
  assert.deepEqual(history.rows.map((row) => row.event_type), ["approved", "reversed", "approved"]);
  assert.equal(history.rows.at(-1).actor_id, adminId);
  assert.deepEqual(
    history.rows.map((row) => row.payment_policy),
    ["deposit_required", null, "deposit_required"]
  );
  const finalChecks = await database.query(`
    select count(*) as count
    from public.rental_availability_checks
    where rental_request_id = $1 and check_type = 'final' and result = 'available'
  `, [fixture.requestId]);
  assert.equal(Number(finalChecks.rows[0].count), 2);

  await database.exec(await readFile(migrationUrls.at(-1), "utf8"));
  const historyAfterRerun = await database.query(
    "select count(*) as count from public.rental_approval_events where rental_request_id = $1",
    [fixture.requestId]
  );
  assert.equal(Number(historyAfterRerun.rows[0].count), 3);
  assert.equal(
    (await database.query(
      "select configuration_value from private.rental_approval_configuration where configuration_key = 'payment_policy'"
    )).rows[0].configuration_value,
    "deposit_required"
  );
});

test("Invoice-paid policy uses authoritative Invoice state and rejects draft/cancelled records", async (t) => {
  const database = await createDatabase();
  t.after(() => database.close());
  await configurePaymentPolicy(database, "invoice_paid");

  const fixture = await prepareApprovalCandidate(database, {
    label: "Invoice Paid",
    rentalItem: item(equipment.roller, 30, 32),
  });
  let checklist = await getChecklist(database, fixture.requestId);
  assert.equal(checklist.checks.payment_requirement.state, "fail");
  assert.match(checklist.checks.payment_requirement.reason, /issued/i);

  await issueInvoice(database, fixture.invoiceId);
  checklist = await getChecklist(database, fixture.requestId);
  assert.equal(checklist.checks.payment_requirement.state, "fail");
  assert.match(checklist.checks.payment_requirement.reason, /outstanding/i);

  const total = await database.query(
    "select total_amount::text from public.invoices where id = $1",
    [fixture.invoiceId]
  );
  await recordPayment(database, fixture.invoiceId, Number(total.rows[0].total_amount));
  checklist = await getChecklist(database, fixture.requestId);
  assert.equal(checklist.checks.payment_requirement.state, "pass");

  const cancelled = await prepareApprovalCandidate(database, {
    label: "Cancelled Invoice",
    rentalItem: item(equipment.bobcat, 40, 42),
  });
  await database.query(
    "update public.invoices set status = 'cancelled' where id = $1",
    [cancelled.invoiceId]
  );
  checklist = await getChecklist(database, cancelled.requestId);
  assert.equal(checklist.checks.payment_requirement.state, "fail");
  assert.match(checklist.checks.payment_requirement.reason, /cancelled or void/i);
});

test("legacy and Release 1 availability use inclusive calendar-date parity", async (t) => {
  const database = await createDatabase();
  t.after(() => database.close());
  await configurePaymentPolicy(database, "deposit_required");

  const blocker = await prepareApprovalCandidate(database, {
    label: "Inclusive Calendar Blocker",
    rentalItem: item(equipment.bobcat, 70, 72),
  });
  await issueInvoice(database, blocker.invoiceId);
  assert.equal((await approve(database, blocker.requestId)).approved, true);

  const names = await database.query(`
    select equipment_requested
    from public.rental_requests
    where id = $1
  `, [blocker.requestId]);
  const bobcatName = names.rows[0].equipment_requested;
  const rollerName = (await database.query(`
    select equipment_name
    from private.rental_equipment_catalog
    where equipment_id = $1
  `, [equipment.roller])).rows[0].equipment_name;

  const scenarios = [
    { label: "End Boundary", equipmentId: equipment.bobcat, equipmentName: bobcatName, start: 72, end: 74, conflict: true },
    { label: "Next Calendar Day", equipmentId: equipment.bobcat, equipmentName: bobcatName, start: 73, end: 74, conflict: false },
    { label: "Start Boundary", equipmentId: equipment.bobcat, equipmentName: bobcatName, start: 68, end: 70, conflict: true },
    { label: "Day Before", equipmentId: equipment.bobcat, equipmentName: bobcatName, start: 68, end: 69, conflict: false },
    { label: "Exact Dates", equipmentId: equipment.bobcat, equipmentName: bobcatName, start: 70, end: 72, conflict: true },
    { label: "Contained Dates", equipmentId: equipment.bobcat, equipmentName: bobcatName, start: 71, end: 72, conflict: true },
    { label: "Containing Dates", equipmentId: equipment.bobcat, equipmentName: bobcatName, start: 69, end: 73, conflict: true },
    { label: "Different Resource", equipmentId: equipment.roller, equipmentName: rollerName, start: 70, end: 72, conflict: false },
  ];

  for (const scenario of scenarios) {
    const startDate = isoDaysFromNow(scenario.start);
    const endDate = isoDaysFromNow(scenario.end);
    assert.equal(
      await legacyHasConflict(
        database,
        scenario.equipmentName,
        startDate,
        endDate
      ),
      scenario.conflict,
      `${scenario.label}: legacy availability`
    );

    const requestId = await createRequest(
      database,
      `Parity ${scenario.label}`,
      item(scenario.equipmentId, scenario.start, scenario.end)
    );
    assert.equal(
      (await confirmInitial(database, requestId)).confirmed,
      !scenario.conflict,
      `${scenario.label}: Release 1 initial availability`
    );
    await database.query(
      "update public.rental_requests set status = 'cancelled' where id = $1",
      [requestId]
    );
  }
});

test("Final availability uses deterministic resource locks and preserves conflict evidence", async (t) => {
  const database = await createDatabase();
  t.after(() => database.close());
  await configurePaymentPolicy(database, "deposit_required");

  const candidate = await prepareApprovalCandidate(database, {
    label: "Final Conflict Candidate",
    rentalItem: item(equipment.bobcat, 50, 52),
  });
  await issueInvoice(database, candidate.invoiceId);

  const blocker = await prepareApprovalCandidate(database, {
    label: "Final Conflict Blocker",
    rentalItem: item(equipment.bobcat, 60, 62),
    finalize: false,
  });
  await database.query(
    `insert into public.agreement_items (
      rental_agreement_id, rental_request_item_id, display_order,
      equipment_id, equipment_name, serial_number, start_date, end_date,
      quantity, daily_rate, billable_days, line_total, notes
    )
    select
      rental_agreement_id, rental_request_item_id, 1,
      equipment_id, equipment_name, serial_number, $2::timestamptz,
      $3::timestamptz, quantity, 0, 2,
      0, 'Concurrent approval test item'
    from public.agreement_items
    where rental_agreement_id = $1 and display_order = 0`,
    [blocker.agreementId, isoDaysFromNow(50), isoDaysFromNow(52)]
  );
  await database.query(`
    update public.rental_agreements
    set current_snapshot_hash = private.rental_agreement_snapshot_hash($1)
    where id = $1
  `, [blocker.agreementId]);
  await acceptAndFinalizeAgreement(database, blocker.agreementId);
  const blockerSecondInitial = await confirmInitial(database, blocker.requestId);
  assert.equal(blockerSecondInitial.confirmed, true);
  const blockerInvoiceId = await createInvoice(database, blocker.agreementId);
  await issueInvoice(database, blockerInvoiceId);
  assert.equal((await approve(database, blocker.requestId)).approved, true);

  await expectDatabaseError(
    () => database.query(
      "update public.rental_requests set status = 'cancelled' where id = $1",
      [blocker.requestId]
    ),
    "Reverse rental approval before cancelling"
  );

  const denied = await approve(database, candidate.requestId);
  assert.equal(denied.approved, false);
  assert.equal(denied.code, "availability_conflict");
  assert.equal(denied.checklist.checks.final_availability.state, "fail");
  const candidateAudit = await database.query(`
    select
      (select count(*) from public.rental_approval_events where rental_request_id = $1) as events,
      (select count(*) from public.rental_availability_checks where rental_request_id = $1 and check_type = 'final' and result = 'conflict') as conflicts
  `, [candidate.requestId]);
  assert.deepEqual(candidateAudit.rows[0], { events: 0, conflicts: 1 });

  // Defense in depth: even a malformed privileged row that bypassed the
  // transition trigger must continue blocking while Approval remains current.
  await database.exec(
    "alter table public.rental_requests disable trigger rental_requests_protect_approval_state"
  );
  await database.query(
    "update public.rental_requests set status = 'cancelled' where id = $1",
    [blocker.requestId]
  );
  await database.exec(
    "alter table public.rental_requests enable trigger rental_requests_protect_approval_state"
  );
  const blockerName = (await database.query(
    "select equipment_requested from public.rental_requests where id = $1",
    [blocker.requestId]
  )).rows[0].equipment_requested;
  await database.query(
    "update public.rental_requests set status = 'cancelled' where id = $1",
    [candidate.requestId]
  );
  assert.equal(
    await legacyHasConflict(
      database,
      blockerName,
      isoDaysFromNow(60),
      isoDaysFromNow(62)
    ),
    true
  );
  await database.query(
    "update public.rental_requests set status = 'new' where id = $1",
    [candidate.requestId]
  );
  const malformedBlockerDenial = await approve(database, candidate.requestId);
  assert.equal(malformedBlockerDenial.approved, false);
  assert.equal(malformedBlockerDenial.code, "availability_conflict");

  await database.query(
    "update public.rental_requests set status = 'confirmed' where id = $1",
    [blocker.requestId]
  );

  const adjacentId = await createRequest(
    database,
    "Adjacent Inclusive",
    item(equipment.bobcat, 52, 53)
  );
  assert.equal((await confirmInitial(database, adjacentId)).confirmed, false);
  assert.equal(
    (await getChecklist(database, adjacentId)).checks.initial_availability.state,
    "fail"
  );

  const laterId = await createRequest(
    database,
    "Nonconflicting Later",
    item(equipment.bobcat, 53, 54)
  );
  assert.equal((await confirmInitial(database, laterId)).confirmed, true);

  const differentUnitId = await createRequest(
    database,
    "Different Unit",
    item(equipment.roller, 50, 52)
  );
  assert.equal((await confirmInitial(database, differentUnitId)).confirmed, true);

  await reverse(database, blocker.requestId);
  await database.query(
    "update public.rental_requests set status = 'cancelled' where id = $1",
    [blocker.requestId]
  );
  assert.equal((await approve(database, candidate.requestId)).approved, true);

  const migration = await readFile(approvalMigrationUrl, "utf8");
  assert.match(
    migration,
    /order by items\.resource_key[\s\S]*pg_catalog\.pg_advisory_xact_lock/i
  );
  assert.match(
    migration,
    /perform private\.lock_rental_approval_resources[\s\S]*private\.rental_approval_has_conflict[\s\S]*approval_status = 'approved'/i
  );
  assert.doesNotMatch(migration, /user_metadata/i);
  assert.doesNotMatch(
    migration,
    /alter\s+table\s+(?:storage|auth|realtime)\./i
  );

  const overlapDefinitions = await database.query(`
    select proname, pg_catalog.pg_get_functiondef(functions.oid) as definition
    from pg_catalog.pg_proc functions
    join pg_catalog.pg_namespace namespaces on namespaces.oid = functions.pronamespace
    where (namespaces.nspname, proname) in (
      ('public', 'has_rental_request_conflict'),
      ('private', 'rental_approval_has_conflict')
    )
  `);
  assert.equal(overlapDefinitions.rows.length, 2);
  for (const definition of overlapDefinitions.rows) {
    assert.match(definition.definition, /private\.rental_calendar_ranges_overlap/i);
  }
  const adminDashboardSource = await readFile(adminDashboardUrl, "utf8");
  assert.match(adminDashboardSource, /rentalDateRangesOverlapInclusive/);
  assert.doesNotMatch(
    adminDashboardSource,
    /newPickup\s*<\s*existingReturn|newReturn\s*>\s*existingPickup/
  );

  const approveDefinitions = await database.query(`
    select namespaces.nspname as schema_name,
      pg_catalog.pg_get_functiondef(functions.oid) as definition
    from pg_catalog.pg_proc functions
    join pg_catalog.pg_namespace namespaces on namespaces.oid = functions.pronamespace
    where (namespaces.nspname = 'public' and functions.proname = 'approve_rental_request')
      or (namespaces.nspname = 'private'
        and functions.proname = 'approve_rental_request_without_driver_license_verification')
  `);
  assert.equal(approveDefinitions.rows.length, 2);
  const approveWrapper = approveDefinitions.rows.find(
    (row) => row.schema_name === "public"
  ).definition;
  const approveTransaction = approveDefinitions.rows.find(
    (row) => row.schema_name === "private"
  ).definition;
  assert.match(
    approveWrapper,
    /assert_current_utah_driver_license[\s\S]*approve_rental_request_without_driver_license_verification/i
  );
  const configurationLockIndex = approveTransaction.indexOf(
    "from private.rental_approval_configuration"
  );
  const paymentGateIndex = approveTransaction.indexOf(
    "checklist := private.rental_approval_checklist"
  );
  assert.ok(configurationLockIndex >= 0);
  assert.match(approveTransaction.slice(configurationLockIndex, paymentGateIndex), /for share/i);
  assert.ok(configurationLockIndex < paymentGateIndex);
  assert.match(
    approveTransaction,
    /rental_approval_events[\s\S]*payment_policy[\s\S]*evaluated_payment_policy/i
  );

  const rpcSecurity = await database.query(`
    select proname, prosecdef, proconfig
    from pg_catalog.pg_proc functions
    join pg_catalog.pg_namespace namespaces on namespaces.oid = functions.pronamespace
    where namespaces.nspname = 'public'
      and proname in (
        'get_rental_approval_checklist',
        'confirm_rental_request_initial_availability',
        'approve_rental_request',
        'reverse_rental_approval'
      )
    order by proname
  `);
  assert.equal(rpcSecurity.rows.length, 4);
  for (const rpc of rpcSecurity.rows) {
    assert.equal(rpc.prosecdef, true);
    assert.deepEqual(rpc.proconfig, ["search_path=pg_catalog, private"]);
  }

  const grants = await database.query(`
    select
      has_function_privilege('anon', 'public.approve_rental_request(uuid,text)', 'execute') as anon_approve,
      has_function_privilege('authenticated', 'public.approve_rental_request(uuid,text)', 'execute') as auth_approve,
      has_table_privilege('authenticated', 'public.rental_approval_events', 'insert') as auth_event_insert,
      has_table_privilege('authenticated', 'public.rental_approval_events', 'update') as auth_event_update,
      has_table_privilege('authenticated', 'public.rental_approval_events', 'delete') as auth_event_delete
  `);
  assert.deepEqual(grants.rows[0], {
    anon_approve: false,
    auth_approve: true,
    auth_event_insert: false,
    auth_event_update: false,
    auth_event_delete: false,
  });
});
