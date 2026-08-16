import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const migrationUrls = [
  "20260805000000_rental_requests_compatibility_baseline.sql",
  "20260805000100_rental_request_items_persistence.sql",
  "20260805000200_rental_agreement_snapshot_persistence.sql",
  "20260806000100_agreement_legal_integrity_remediation.sql",
  "20260806000200_immutable_multi_item_invoice_persistence.sql",
  "20260806000300_invoice_snapshot_integrity_remediation.sql",
  "20260807000100_private_rental_document_workflow.sql",
  "20260808000100_rental_approval_workflow.sql",
  "20260809000100_release1_production_shape_reconciliation.sql",
  "20260810000100_utah_driver_license_verification.sql",
].map((name) => new URL(`../../supabase/migrations/${name}`, import.meta.url));

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
      'utah-license-test', 'Utah License Test',
      'Synthetic legal terms for Utah driver-license verification tests.',
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

const callStaffRpc = async (
  database,
  sql,
  parameters,
  actorId = staffId,
  role = "staff"
) => {
  await asStaff(database, actorId, role);
  try {
    return await database.query(sql, parameters);
  } finally {
    await resetRole(database);
  }
};

const isoDaysFromNow = (days) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(16, 0, 0, 0);
  return date.toISOString();
};

const createRequest = async (database, label, startDay = 30) => {
  await setRole(database, "anon");
  try {
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
          project_type: "Utah license workflow validation",
          notes: "Synthetic test record",
          agreement_accepted: true,
        }),
        JSON.stringify([
          {
            equipment_id: "bobcat-t550-skid-steer",
            start_date: isoDaysFromNow(startDay),
            end_date: isoDaysFromNow(startDay + 2),
            quantity: 1,
            notes: null,
          },
        ]),
      ]
    );
    return result.rows[0].id;
  } finally {
    await resetRole(database);
  }
};

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

const reviewLicense = (
  database,
  requestId,
  expectedDocumentId,
  status,
  issuingState,
  note,
  actorId = staffId,
  role = "staff"
) => callStaffRpc(
  database,
  "select public.review_rental_driver_license($1::uuid, $2::uuid, $3::text, $4::text, $5::text) as id",
  [requestId, expectedDocumentId, status, issuingState, note],
  actorId,
  role
).then((result) => result.rows[0].id);

const reviewInsurance = (database, requestId) => callStaffRpc(
  database,
  "select public.review_rental_insurance($1::uuid, 'verified', 'Coverage reviewed')",
  [requestId]
);

const createAgreement = (database, requestId) => callStaffRpc(
  database,
  "select public.create_rental_agreement_for_request($1::uuid) as id",
  [requestId]
).then((result) => result.rows[0].id);

const acceptAgreement = (database, agreementId) => callStaffRpc(
  database,
  "select public.record_rental_agreement_acceptance($1::uuid, 'Utah Test Signer', 'Owner', true, true)",
  [agreementId]
);

const finalizeAgreement = (database, agreementId) => callStaffRpc(
  database,
  "select public.finalize_rental_agreement($1::uuid)",
  [agreementId]
);

const getChecklist = (database, requestId) => callStaffRpc(
  database,
  "select public.get_rental_approval_checklist($1::uuid) as checklist",
  [requestId]
).then((result) => result.rows[0].checklist);

test("Utah review is authorized, current-document-bound, append-only, and replacement-safe", async (t) => {
  const database = await createDatabase();
  t.after(() => database.close());
  const requestId = await createRequest(database, "Review Audit");

  const security = await database.query(`
    select
      functions.prosecdef as security_definer,
      functions.proconfig,
      has_function_privilege(
        'anon',
        'public.review_rental_driver_license(uuid,uuid,text,text,text)',
        'execute'
      ) as anon_execute,
      has_function_privilege(
        'authenticated',
        'public.review_rental_driver_license(uuid,uuid,text,text,text)',
        'execute'
      ) as authenticated_execute,
      has_table_privilege(
        'authenticated', 'public.rental_driver_license_reviews', 'insert'
      ) as authenticated_insert,
      has_table_privilege(
        'authenticated', 'public.rental_driver_license_reviews', 'update'
      ) as authenticated_update,
      has_table_privilege(
        'authenticated', 'public.rental_driver_license_reviews', 'delete'
      ) as authenticated_delete
    from pg_catalog.pg_proc functions
    join pg_catalog.pg_namespace namespaces on namespaces.oid = functions.pronamespace
    where namespaces.nspname = 'public'
      and functions.proname = 'review_rental_driver_license'
  `);
  assert.deepEqual(security.rows[0], {
    security_definer: true,
    proconfig: ["search_path=pg_catalog, private"],
    anon_execute: false,
    authenticated_execute: true,
    authenticated_insert: false,
    authenticated_update: false,
    authenticated_delete: false,
  });

  let state = await database.query(`
    select driver_license_verification_status,
      driver_license_reviewed_document_id,
      driver_license_reviewed_by,
      driver_license_reviewed_at
    from public.rental_requests where id = $1
  `, [requestId]);
  assert.deepEqual(state.rows[0], {
    driver_license_verification_status: "pending",
    driver_license_reviewed_document_id: null,
    driver_license_reviewed_by: null,
    driver_license_reviewed_at: null,
  });
  assert.equal(
    Number((await database.query("select count(*) as count from public.rental_driver_license_reviews")).rows[0].count),
    0
  );

  const firstLicense = await registerDocument(database, requestId, "driver_license");
  await expectDatabaseError(
    () => database.query(
      "update public.rental_requests set driver_license_verification_status = 'verified' where id = $1",
      [requestId]
    ),
    "trusted review workflow"
  );

  for (const claims of [
    { sub: randomUUID(), app_metadata: { role: "customer" } },
    { sub: randomUUID(), user_metadata: { role: "staff" } },
  ]) {
    await setRole(database, "authenticated", claims);
    await expectDatabaseError(
      () => database.query(
        "select public.review_rental_driver_license($1::uuid, $2::uuid, 'verified', 'UT', null)",
        [requestId, firstLicense]
      ),
      "staff authorization"
    );
    assert.equal(
      (await database.query("select id from public.rental_driver_license_reviews")).rows.length,
      0
    );
    await resetRole(database);
  }

  await asStaff(database);
  await expectDatabaseError(
    () => database.query(
      "select public.review_rental_driver_license($1::uuid, $2::uuid, 'verified', 'CO', null)",
      [requestId, firstLicense]
    ),
    "Utah-issued"
  );
  await expectDatabaseError(
    () => database.query(
      "select public.review_rental_driver_license($1::uuid, $2::uuid, 'rejected', 'CO', '   ')",
      [requestId, firstLicense]
    ),
    "rejection reason"
  );
  await resetRole(database);

  assert.equal(
    await reviewLicense(database, requestId, firstLicense, "verified", " ut ", "Manual Utah review", adminId, "admin"),
    firstLicense
  );
  state = await database.query(`
    select driver_license_verification_status, driver_license_reviewed_document_id,
      driver_license_issuing_state, driver_license_reviewed_by,
      driver_license_reviewed_at is not null as reviewed_at
    from public.rental_requests where id = $1
  `, [requestId]);
  assert.deepEqual(state.rows[0], {
    driver_license_verification_status: "verified",
    driver_license_reviewed_document_id: firstLicense,
    driver_license_issuing_state: "UT",
    driver_license_reviewed_by: adminId,
    reviewed_at: true,
  });
  await asStaff(database);
  assert.equal(
    (await database.query(
      "select id from public.rental_driver_license_reviews where rental_request_id = $1",
      [requestId]
    )).rows.length,
    1
  );
  await resetRole(database);
  await asStaff(database, adminId, "admin");
  assert.equal(
    (await database.query(
      "select id from public.rental_driver_license_reviews where rental_request_id = $1",
      [requestId]
    )).rows.length,
    1
  );
  await resetRole(database);

  for (const claims of [
    { sub: randomUUID(), app_metadata: { role: "customer" } },
    { sub: randomUUID(), user_metadata: { role: "staff" } },
  ]) {
    await setRole(database, "authenticated", claims);
    assert.equal(
      (await database.query(
        "select id from public.rental_driver_license_reviews where rental_request_id = $1",
        [requestId]
      )).rows.length,
      0
    );
    await resetRole(database);
  }

  const secondLicense = await registerDocument(database, requestId, "driver_license");
  state = await database.query(`
    select driver_license_verification_status, driver_license_reviewed_document_id,
      driver_license_issuing_state, driver_license_reviewed_by,
      driver_license_reviewed_at, driver_license_review_note
    from public.rental_requests where id = $1
  `, [requestId]);
  assert.deepEqual(state.rows[0], {
    driver_license_verification_status: "pending",
    driver_license_reviewed_document_id: null,
    driver_license_issuing_state: null,
    driver_license_reviewed_by: null,
    driver_license_reviewed_at: null,
    driver_license_review_note: null,
  });

  const historyBeforeSecondReview = await database.query(`
    select driver_license_document_id, review_status, issuing_state
    from public.rental_driver_license_reviews where rental_request_id = $1
  `, [requestId]);
  assert.deepEqual(historyBeforeSecondReview.rows, [{
    driver_license_document_id: firstLicense,
    review_status: "verified",
    issuing_state: "UT",
  }]);
  assert.equal(
    Number((await database.query(
      "select count(*) as count from public.rental_documents where rental_request_id = $1",
      [requestId]
    )).rows[0].count),
    2
  );

  await asStaff(database);
  await expectDatabaseError(
    () => database.query(
      "select public.review_rental_driver_license($1::uuid, $2::uuid, 'verified', 'UT', 'Stale inspected document')",
      [requestId, firstLicense]
    ),
    "document changed after it was inspected"
  );
  await resetRole(database);
  state = await database.query(`
    select driver_license_verification_status, driver_license_reviewed_document_id
    from public.rental_requests where id = $1
  `, [requestId]);
  assert.deepEqual(state.rows[0], {
    driver_license_verification_status: "pending",
    driver_license_reviewed_document_id: null,
  });
  assert.equal(
    Number((await database.query(
      "select count(*) as count from public.rental_driver_license_reviews where rental_request_id = $1",
      [requestId]
    )).rows[0].count),
    1
  );

  assert.equal(
    await reviewLicense(database, requestId, secondLicense, "rejected", "co", "Out-of-state license"),
    secondLicense
  );
  const history = await database.query(`
    select driver_license_document_id, review_status, issuing_state, review_note
    from public.rental_driver_license_reviews
    where rental_request_id = $1 order by reviewed_at, id
  `, [requestId]);
  assert.equal(history.rows.length, 2);
  assert.equal(history.rows[1].driver_license_document_id, secondLicense);
  assert.equal(history.rows[1].review_status, "rejected");
  assert.equal(history.rows[1].issuing_state, "CO");
  assert.equal(history.rows[1].review_note, "Out-of-state license");

  await expectDatabaseError(
    () => database.query(
      "update public.rental_driver_license_reviews set review_note = 'tampered' where rental_request_id = $1",
      [requestId]
    ),
    "append-only"
  );
  await expectDatabaseError(
    () => database.query(
      "delete from public.rental_driver_license_reviews where rental_request_id = $1",
      [requestId]
    ),
    "append-only"
  );
});

test("Agreement finalization and Approval fail closed, with audited post-Approval correction", async (t) => {
  const database = await createDatabase();
  t.after(() => database.close());
  const requestId = await createRequest(database, "Lifecycle", 60);
  await callStaffRpc(
    database,
    "select public.confirm_rental_request_initial_availability($1::uuid, 'Initial check')",
    [requestId]
  );
  const currentLicenseId = await registerDocument(database, requestId, "driver_license");
  await registerDocument(database, requestId, "insurance");
  await reviewInsurance(database, requestId);
  const agreementId = await createAgreement(database, requestId);
  await acceptAgreement(database, agreementId);

  await asStaff(database);
  await expectDatabaseError(
    () => database.query("select public.finalize_rental_agreement($1::uuid)", [agreementId]),
    "pending or stale|Utah-issued"
  );
  await resetRole(database);

  await reviewLicense(database, requestId, currentLicenseId, "rejected", "NV", "Out-of-state");
  await asStaff(database);
  await expectDatabaseError(
    () => database.query("select public.finalize_rental_agreement($1::uuid)", [agreementId]),
    "rejected"
  );
  await resetRole(database);

  await reviewLicense(database, requestId, currentLicenseId, "verified", "UT", "Valid Utah license");
  await finalizeAgreement(database, agreementId);

  const invoice = await callStaffRpc(
    database,
    "select public.create_invoice_for_agreement($1::uuid) as id",
    [agreementId]
  );
  const invoiceId = invoice.rows[0].id;
  await callStaffRpc(database, "select public.issue_invoice($1::uuid)", [invoiceId]);
  const total = await database.query(
    "select total_amount from public.invoices where id = $1",
    [invoiceId]
  );
  await callStaffRpc(
    database,
    "select public.record_invoice_payment($1::uuid, $2::numeric, 'card', 'ut-test', 'Paid in full')",
    [invoiceId, total.rows[0].total_amount]
  );

  assert.equal(
    (await database.query(
      "select configuration_value from private.rental_approval_configuration where configuration_key = 'payment_policy'"
    )).rows[0].configuration_value,
    "unconfigured"
  );
  await database.query(`
    update private.rental_approval_configuration
    set configuration_value = 'invoice_paid', updated_at = now()
    where configuration_key = 'payment_policy'
  `);

  let checklist = await getChecklist(database, requestId);
  assert.equal(checklist.checks.driver_license.state, "pass");
  assert.equal(checklist.checks.driver_license_verification.state, "pass");
  assert.equal(checklist.checks.insurance_verification.state, "pass");
  assert.equal(checklist.checks.payment_requirement.state, "pass");
  assert.equal(checklist.actions.canApprove, true);

  const approved = await callStaffRpc(
    database,
    "select public.approve_rental_request($1::uuid, 'Approved after Utah review') as result",
    [requestId]
  );
  assert.equal(approved.rows[0].result.approved, true);
  let capabilities = await callStaffRpc(
    database,
    "select public.get_rental_document_workflow_capabilities($1::uuid) as capabilities",
    [requestId]
  ).then((result) => result.rows[0].capabilities);
  assert.equal(capabilities.approvalStatus, "approved");
  assert.equal(capabilities.canRejectDriverLicense, false);
  assert.match(capabilities.driverLicenseReviewReason, /Reverse the audited rental Approval/i);

  await asStaff(database);
  await expectDatabaseError(
    () => database.query(
      "select public.review_rental_driver_license($1::uuid, $2::uuid, 'rejected', 'NV', 'Discovered after Approval')",
      [requestId, currentLicenseId]
    ),
    "Reverse the audited rental Approval"
  );
  await resetRole(database);

  await callStaffRpc(
    database,
    "select public.reverse_rental_approval($1::uuid, 'Out-of-state license discovered')",
    [requestId]
  );
  capabilities = await callStaffRpc(
    database,
    "select public.get_rental_document_workflow_capabilities($1::uuid) as capabilities",
    [requestId]
  ).then((result) => result.rows[0].capabilities);
  assert.equal(capabilities.approvalStatus, "reversed");
  assert.equal(capabilities.canVerifyDriverLicense, false);
  assert.equal(capabilities.canRejectDriverLicense, true);
  const lockedBefore = await database.query(
    "select status, locked_at, current_snapshot_hash from public.rental_agreements where id = $1",
    [agreementId]
  );
  const eventCountBefore = Number((await database.query(
    "select count(*) as count from public.rental_approval_events where rental_request_id = $1",
    [requestId]
  )).rows[0].count);

  await reviewLicense(
    database,
    requestId,
    currentLicenseId,
    "rejected",
    "NV",
    "Out-of-state license discovered after Approval",
    adminId,
    "admin"
  );
  const lockedAfter = await database.query(
    "select status, locked_at, current_snapshot_hash from public.rental_agreements where id = $1",
    [agreementId]
  );
  assert.deepEqual(lockedAfter.rows[0], lockedBefore.rows[0]);
  assert.equal(
    Number((await database.query(
      "select count(*) as count from public.rental_approval_events where rental_request_id = $1",
      [requestId]
    )).rows[0].count),
    eventCountBefore
  );

  checklist = await getChecklist(database, requestId);
  assert.equal(checklist.checks.driver_license_verification.state, "fail");
  assert.equal(checklist.actions.canApprove, false);

  const finalEvidenceBeforeRejectedApproval = await database.query(`
    select
      (select count(*)::integer from public.rental_availability_checks
        where rental_request_id = $1 and check_type = 'final') as final_checks,
      (select count(*)::integer from public.rental_approval_events
        where rental_request_id = $1) as approval_events
  `, [requestId]);
  await database.exec(`
    create or replace function private.rental_approval_has_conflict(
      target_rental_request_id uuid
    )
    returns boolean
    language sql
    stable
    security definer
    set search_path = pg_catalog, private
    as 'select true';
  `);

  await asStaff(database);
  await expectDatabaseError(
    () => database.query(
      "select public.review_rental_driver_license($1::uuid, $2::uuid, 'verified', 'UT', 'Late reverification')",
      [requestId, currentLicenseId]
    ),
    "cannot be introduced after Agreement finalization"
  );
  await expectDatabaseError(
    () => database.query(
      "select public.approve_rental_request($1::uuid, 'Improper reapproval')",
      [requestId]
    ),
    "rejected|Utah-issued"
  );
  await resetRole(database);
  assert.deepEqual(
    (await database.query(`
      select
        (select count(*)::integer from public.rental_availability_checks
          where rental_request_id = $1 and check_type = 'final') as final_checks,
        (select count(*)::integer from public.rental_approval_events
          where rental_request_id = $1) as approval_events
    `, [requestId])).rows[0],
    finalEvidenceBeforeRejectedApproval.rows[0]
  );
});

test("locked but never-approved Agreements allow rejection without mutating immutable history", async (t) => {
  const database = await createDatabase();
  t.after(() => database.close());
  const requestId = await createRequest(database, "Locked Rejection", 75);
  await callStaffRpc(
    database,
    "select public.confirm_rental_request_initial_availability($1::uuid, 'Initial check')",
    [requestId]
  );
  const driverLicenseId = await registerDocument(database, requestId, "driver_license");
  await registerDocument(database, requestId, "insurance");
  await reviewInsurance(database, requestId);
  await reviewLicense(
    database,
    requestId,
    driverLicenseId,
    "verified",
    "UT",
    "Valid before finalization"
  );
  const agreementId = await createAgreement(database, requestId);
  await acceptAgreement(database, agreementId);
  await finalizeAgreement(database, agreementId);

  const agreementBefore = await database.query(
    "select status, locked_at, current_snapshot_hash from public.rental_agreements where id = $1",
    [agreementId]
  );
  const eventsBefore = await database.query(`
    select id, event_type, actor_id, occurred_at, note
    from public.rental_approval_events
    where rental_request_id = $1
    order by occurred_at, id
  `, [requestId]);
  const capabilities = await callStaffRpc(
    database,
    "select public.get_rental_document_workflow_capabilities($1::uuid) as capabilities",
    [requestId]
  ).then((result) => result.rows[0].capabilities);
  assert.deepEqual(capabilities, {
    agreementFinalized: true,
    approvalStatus: "pending",
    canUploadOrReplaceDocuments: false,
    canReviewInsurance: false,
    canVerifyDriverLicense: false,
    canRejectDriverLicense: true,
    driverLicenseReviewReason:
      "The Agreement is finalized. Verification and document changes are locked; rejection remains available.",
  });

  await reviewLicense(
    database,
    requestId,
    driverLicenseId,
    "rejected",
    "NV",
    "Invalid state discovered before final Approval"
  );
  assert.deepEqual(
    (await database.query(
      "select status, locked_at, current_snapshot_hash from public.rental_agreements where id = $1",
      [agreementId]
    )).rows[0],
    agreementBefore.rows[0]
  );
  assert.deepEqual(
    (await database.query(`
      select id, event_type, actor_id, occurred_at, note
      from public.rental_approval_events
      where rental_request_id = $1
      order by occurred_at, id
    `, [requestId])).rows,
    eventsBefore.rows
  );
  assert.equal(
    (await database.query(
      "select approval_status from public.rental_requests where id = $1",
      [requestId]
    )).rows[0].approval_status,
    "pending"
  );

  await asStaff(database);
  await expectDatabaseError(
    () => database.query(
      "select public.review_rental_driver_license($1::uuid, $2::uuid, 'verified', 'UT', 'Cannot restore eligibility')",
      [requestId, driverLicenseId]
    ),
    "cannot be introduced after Agreement finalization"
  );
  await resetRole(database);
});

test("defensive stale license evidence cannot pass the final Approval transaction", async (t) => {
  const database = await createDatabase();
  t.after(() => database.close());
  const requestId = await createRequest(database, "Stale Defense", 90);
  await callStaffRpc(
    database,
    "select public.confirm_rental_request_initial_availability($1::uuid, 'Initial check')",
    [requestId]
  );
  const oldLicenseId = await registerDocument(database, requestId, "driver_license");
  const currentLicenseId = await registerDocument(database, requestId, "driver_license");
  await registerDocument(database, requestId, "insurance");
  await reviewInsurance(database, requestId);
  assert.equal(
    await reviewLicense(database, requestId, currentLicenseId, "verified", "UT", "Current Utah license"),
    currentLicenseId
  );

  const agreementId = await createAgreement(database, requestId);
  await acceptAgreement(database, agreementId);
  await finalizeAgreement(database, agreementId);
  const invoice = await callStaffRpc(
    database,
    "select public.create_invoice_for_agreement($1::uuid) as id",
    [agreementId]
  );
  const invoiceId = invoice.rows[0].id;
  await callStaffRpc(database, "select public.issue_invoice($1::uuid)", [invoiceId]);
  const total = await database.query(
    "select total_amount from public.invoices where id = $1",
    [invoiceId]
  );
  await callStaffRpc(
    database,
    "select public.record_invoice_payment($1::uuid, $2::numeric, 'card', 'stale-test', 'Paid in full')",
    [invoiceId, total.rows[0].total_amount]
  );
  await database.query(`
    update private.rental_approval_configuration
    set configuration_value = 'invoice_paid', updated_at = now()
    where configuration_key = 'payment_policy'
  `);

  // Simulate externally corrupted historical evidence. Normal writes cannot
  // produce this state because the protected replacement workflow resets it.
  await database.exec(
    "alter table public.rental_requests disable trigger rental_requests_protect_driver_license_review"
  );
  await database.query(`
    update public.rental_requests
    set driver_license_reviewed_document_id = $2
    where id = $1
  `, [requestId, oldLicenseId]);
  await database.exec(
    "alter table public.rental_requests enable trigger rental_requests_protect_driver_license_review"
  );

  const checklist = await getChecklist(database, requestId);
  assert.equal(checklist.checks.driver_license_verification.state, "stale");
  assert.equal(checklist.actions.canApprove, false);

  await asStaff(database);
  await expectDatabaseError(
    () => database.query(
      "select public.approve_rental_request($1::uuid, 'Stale evidence must fail')",
      [requestId]
    ),
    "pending or stale"
  );
  await resetRole(database);
  assert.equal(
    Number((await database.query(
      "select count(*) as count from public.rental_approval_events where rental_request_id = $1",
      [requestId]
    )).rows[0].count),
    0
  );
  assert.equal(
    Number((await database.query(
      "select count(*) as count from public.rental_availability_checks where rental_request_id = $1 and check_type = 'final'",
      [requestId]
    )).rows[0].count),
    0
  );
});
