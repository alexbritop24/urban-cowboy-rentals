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
];

const staffId = "10000000-0000-4000-8000-000000000001";

const createDatabase = async () => {
  const database = new PGlite({ extensions: { pgcrypto } });
  await database.exec(`
    create schema extensions;
    create extension pgcrypto with schema extensions;
    create role anon nologin;
    create role authenticated nologin;
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
    -- Hosted Supabase owns storage.objects and enables RLS before application
    -- migrations run. The harness models that platform-owned prerequisite.
    alter table storage.objects enable row level security;
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

const expectDatabaseError = async (operation, expectedText) => {
  await assert.rejects(operation, (error) => {
    assert.match(error.message, new RegExp(expectedText, "i"));
    return true;
  });
};

const createLegacyRequest = async (database, label) => {
  const result = await database.query(`
    insert into public.rental_requests (
      customer_type, full_name, phone, email, equipment_requested,
      rental_start_date, rental_end_date, pickup_date, return_date,
      rental_duration, fulfillment_type, project_type, notes,
      agreement_accepted, status, source, priority, payment_status,
      deposit_status, delivery_status, availability_status,
      insurance_verification_status
    ) values (
      'individual', $1, '8015550100', $2,
      '2024 Bobcat T550 Track Loader', current_date + 10, current_date + 12,
      now() + interval '10 days', now() + interval '12 days', '2 days',
      'Pickup', 'Document workflow test', null, true, 'new', 'website',
      'normal', 'unpaid', 'not_required', 'not_scheduled', 'available', 'verified'
    ) returning id
  `, [label, `${label.toLowerCase().replaceAll(" ", "-")}@example.test`]);
  return result.rows[0].id;
};

const createAgreement = async (database, requestId) => {
  await setRole(database, "authenticated", {
    sub: staffId,
    app_metadata: { role: "staff" },
  });
  const result = await database.query(
    "select public.create_rental_agreement_for_request($1::uuid) as id",
    [requestId]
  );
  await resetRole(database);
  return result.rows[0].id;
};

const objectPath = (requestId, documentType, objectId, extension = "pdf") =>
  `${requestId}/${documentType}/${objectId}.${extension}`;

const registerDocument = async (
  database,
  requestId,
  documentType,
  objectId,
  filename = `${documentType}.pdf`
) => {
  const path = objectPath(requestId, documentType, objectId);
  await database.query(
    `insert into storage.objects (bucket_id, name, metadata)
     values ('rental-documents', $1, '{"size":5,"mimetype":"application/pdf"}'::jsonb)`,
    [path]
  );
  await setRole(database, "authenticated", {
    sub: staffId,
    app_metadata: { role: "staff" },
  });
  const result = await database.query(
    `select public.register_rental_document(
      $1::uuid, $2::text, 'rental-documents', $3::text,
      $4::text, 'application/pdf', 5::bigint
    ) as id`,
    [requestId, documentType, path, filename]
  );
  await resetRole(database);
  return result.rows[0].id;
};

const reviewInsurance = async (database, requestId, status, note = null) => {
  await setRole(database, "authenticated", {
    sub: staffId,
    app_metadata: { app_role: "admin" },
  });
  const result = await database.query(
    "select public.review_rental_insurance($1::uuid, $2::text, $3::text) as id",
    [requestId, status, note]
  );
  await resetRole(database);
  return result.rows[0].id;
};

test("private rental documents preserve history, authorization, and finalization gates", async (t) => {
  const database = await createDatabase();
  t.after(() => database.close());

  for (let index = 0; index < migrationUrls.length - 1; index += 1) {
    await database.exec(await readFile(migrationUrls[index], "utf8"));
  }
  await database.exec(`
    insert into public.agreement_clauses (
      clause_key, title, body, display_order, enabled, category, version
    ) values (
      'document-test-terms', 'Document Test Terms',
      'The renter accepts the approved Release 1 document workflow terms.',
      0, true, 'general', 1
    )
  `);

  const missingLicenseRequest = await createLegacyRequest(database, "Missing License");
  const missingInsuranceRequest = await createLegacyRequest(database, "Missing Insurance");
  const pendingRequest = await createLegacyRequest(database, "Pending Insurance");
  const completeRequest = await createLegacyRequest(database, "Complete Documents");

  const missingLicenseAgreement = await createAgreement(database, missingLicenseRequest);
  const missingInsuranceAgreement = await createAgreement(database, missingInsuranceRequest);
  const pendingAgreement = await createAgreement(database, pendingRequest);
  const completeAgreement = await createAgreement(database, completeRequest);

  const documentMigration = await readFile(migrationUrls.at(-1), "utf8");
  assert.match(
    documentMigration,
    /create\s+policy\s+"staff can read private rental documents"[\s\S]*?bucket_id\s*=\s*'rental-documents'[\s\S]*?private\.is_staff\(\)/i
  );
  assert.match(
    documentMigration,
    /create\s+trigger\s+rental_document_objects_prevent_orphan[\s\S]*?on\s+storage\.objects/i
  );
  await database.exec(documentMigration);

  const bucket = await database.query(
    "select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'rental-documents'"
  );
  assert.equal(bucket.rows[0].public, false);
  assert.equal(Number(bucket.rows[0].file_size_limit), 10485760);
  assert.deepEqual(bucket.rows[0].allowed_mime_types, [
    "application/pdf",
    "image/jpeg",
    "image/png",
  ]);

  const storageSecurity = await database.query(`
    select relrowsecurity as rls_enabled
    from pg_catalog.pg_class
    where oid = 'storage.objects'::pg_catalog.regclass
  `);
  assert.equal(storageSecurity.rows[0].rls_enabled, true);

  const policies = await database.query(`
    select schemaname, tablename, policyname, roles, cmd
    from pg_policies
    where (schemaname = 'public' and tablename = 'rental_documents')
       or (schemaname = 'storage' and tablename = 'objects')
    order by schemaname, policyname
  `);
  assert.deepEqual(
    policies.rows.map((row) => [row.schemaname, row.policyname, row.cmd]),
    [
      ["public", "staff can read rental document metadata", "SELECT"],
      ["storage", "staff can read private rental documents", "SELECT"],
    ]
  );

  const grants = await database.query(`
    select
      has_table_privilege('anon', 'public.rental_documents', 'select') as anon_select,
      has_table_privilege('authenticated', 'public.rental_documents', 'select') as auth_select,
      has_table_privilege('authenticated', 'public.rental_documents', 'insert') as auth_insert,
      has_table_privilege('authenticated', 'public.rental_documents', 'update') as auth_update,
      has_table_privilege('authenticated', 'public.rental_documents', 'delete') as auth_delete,
      has_function_privilege(
        'anon',
        'public.register_rental_document(uuid,text,text,text,text,text,bigint)',
        'execute'
      ) as anon_register,
      has_function_privilege(
        'authenticated',
        'public.register_rental_document(uuid,text,text,text,text,text,bigint)',
        'execute'
      ) as auth_register
  `);
  assert.deepEqual(grants.rows[0], {
    anon_select: false,
    auth_select: true,
    auth_insert: false,
    auth_update: false,
    auth_delete: false,
    anon_register: false,
    auth_register: true,
  });

  const rpcSecurity = await database.query(`
    select proname, prosecdef, proconfig
    from pg_proc functions
    join pg_namespace namespaces on namespaces.oid = functions.pronamespace
    where namespaces.nspname = 'public'
      and proname in ('register_rental_document', 'review_rental_insurance', 'finalize_rental_agreement')
    order by proname
  `);
  assert.equal(rpcSecurity.rows.length, 3);
  for (const rpc of rpcSecurity.rows) {
    assert.equal(rpc.prosecdef, true);
    assert.deepEqual(rpc.proconfig, ["search_path=pg_catalog, private"]);
  }

  await setRole(database, "anon");
  await expectDatabaseError(
    () => database.query("select id from public.rental_documents"),
    "permission denied"
  );
  await resetRole(database);

  await setRole(database, "authenticated", {
    sub: "20000000-0000-4000-8000-000000000002",
    app_metadata: { role: "customer" },
  });
  assert.equal((await database.query("select id from public.rental_documents")).rows.length, 0);
  await expectDatabaseError(
    () => database.query(
      `insert into storage.objects (bucket_id, name, metadata)
       values ('rental-documents', 'guessed/path.pdf', '{}'::jsonb)`
    ),
    "permission denied"
  );
  await expectDatabaseError(
    () => database.query(
      "select public.review_rental_insurance($1::uuid, 'verified', null)",
      [completeRequest]
    ),
    "staff authorization"
  );
  await resetRole(database);

  await expectDatabaseError(
    () => database.query(
      "update public.rental_requests set insurance_verification_status = 'rejected' where id = $1",
      [completeRequest]
    ),
    "trusted document workflow"
  );

  const missingObjectPath = objectPath(
    completeRequest,
    "driver_license",
    "30000000-0000-4000-8000-000000000009"
  );
  await setRole(database, "authenticated", {
    sub: staffId,
    app_metadata: { role: "staff" },
  });
  await expectDatabaseError(
    () => database.query(
      `select public.register_rental_document(
        $1::uuid, 'driver_license', 'rental-documents', $2::text,
        'missing.pdf', 'application/pdf', 5::bigint
      )`,
      [completeRequest, missingObjectPath]
    ),
    "was not stored"
  );
  await resetRole(database);

  await setRole(database, "authenticated", {
    sub: "20000000-0000-4000-8000-000000000002",
    user_metadata: { role: "staff" },
  });
  await expectDatabaseError(
    () => database.query(
      "select public.review_rental_insurance($1::uuid, 'verified', null)",
      [completeRequest]
    ),
    "staff authorization"
  );
  await resetRole(database);

  const missingLicenseInsurance = await registerDocument(
    database,
    missingLicenseRequest,
    "insurance",
    "30000000-0000-4000-8000-000000000001"
  );
  assert.equal(
    await reviewInsurance(database, missingLicenseRequest, "verified", "Coverage reviewed"),
    missingLicenseInsurance
  );

  await registerDocument(
    database,
    missingInsuranceRequest,
    "driver_license",
    "30000000-0000-4000-8000-000000000002"
  );

  await registerDocument(
    database,
    pendingRequest,
    "driver_license",
    "30000000-0000-4000-8000-000000000003"
  );
  await registerDocument(
    database,
    pendingRequest,
    "insurance",
    "30000000-0000-4000-8000-000000000004"
  );

  const firstLicense = await registerDocument(
    database,
    completeRequest,
    "driver_license",
    "30000000-0000-4000-8000-000000000005",
    "license-original.pdf"
  );
  const firstInsurance = await registerDocument(
    database,
    completeRequest,
    "insurance",
    "30000000-0000-4000-8000-000000000006",
    "insurance-original.pdf"
  );
  assert.equal(await reviewInsurance(database, completeRequest, "rejected", "Expired"), firstInsurance);

  for (const [agreementId, expected] of [
    [missingLicenseAgreement, "Driver license is required"],
    [missingInsuranceAgreement, "Insurance document is required"],
    [pendingAgreement, "Insurance must be verified"],
    [completeAgreement, "Insurance must be verified"],
  ]) {
    await setRole(database, "authenticated", {
      sub: staffId,
      app_metadata: { role: "staff" },
    });
    await expectDatabaseError(
      () => database.query("select public.finalize_rental_agreement($1::uuid)", [agreementId]),
      expected
    );
    await resetRole(database);
  }

  await reviewInsurance(database, completeRequest, "verified", "Current and valid");
  const secondLicense = await registerDocument(
    database,
    completeRequest,
    "driver_license",
    "30000000-0000-4000-8000-000000000007",
    "license-current.pdf"
  );
  let requestState = await database.query(`
    select insurance_verification_status, insurance_reviewed_document_id
    from public.rental_requests where id = $1
  `, [completeRequest]);
  assert.equal(requestState.rows[0].insurance_verification_status, "verified");
  assert.equal(requestState.rows[0].insurance_reviewed_document_id, firstInsurance);

  const secondInsurance = await registerDocument(
    database,
    completeRequest,
    "insurance",
    "30000000-0000-4000-8000-000000000008",
    "insurance-current.pdf"
  );
  requestState = await database.query(`
    select insurance_verification_status, insurance_reviewed_document_id,
      insurance_reviewed_by, insurance_reviewed_at, insurance_review_note
    from public.rental_requests where id = $1
  `, [completeRequest]);
  assert.deepEqual(requestState.rows[0], {
    insurance_verification_status: "pending",
    insurance_reviewed_document_id: null,
    insurance_reviewed_by: null,
    insurance_reviewed_at: null,
    insurance_review_note: null,
  });

  const history = await database.query(`
    select id, document_type, is_current, replaces_document_id,
      replaced_by_document_id, replaced_at, replaced_by
    from public.rental_documents
    where rental_request_id = $1
    order by document_type, uploaded_at, id
  `, [completeRequest]);
  assert.equal(history.rows.length, 4);
  const oldLicense = history.rows.find((row) => row.id === firstLicense);
  const newLicense = history.rows.find((row) => row.id === secondLicense);
  const oldInsurance = history.rows.find((row) => row.id === firstInsurance);
  const newInsurance = history.rows.find((row) => row.id === secondInsurance);
  assert.equal(oldLicense.is_current, false);
  assert.equal(oldLicense.replaced_by_document_id, secondLicense);
  assert.equal(newLicense.replaces_document_id, firstLicense);
  assert.equal(newLicense.is_current, true);
  assert.equal(oldInsurance.is_current, false);
  assert.equal(oldInsurance.replaced_by_document_id, secondInsurance);
  assert.equal(newInsurance.replaces_document_id, firstInsurance);
  assert.equal(newInsurance.is_current, true);

  const currentCounts = await database.query(`
    select document_type, count(*)::integer as count
    from public.rental_documents
    where rental_request_id = $1 and is_current
    group by document_type order by document_type
  `, [completeRequest]);
  assert.deepEqual(currentCounts.rows, [
    { document_type: "driver_license", count: 1 },
    { document_type: "insurance", count: 1 },
  ]);

  await setRole(database, "authenticated", {
    sub: staffId,
    app_metadata: { role: "staff" },
  });
  await expectDatabaseError(
    () => database.query(
      "update public.rental_requests set insurance_verification_status = 'verified' where id = $1",
      [completeRequest]
    ),
    "trusted document workflow"
  );
  await expectDatabaseError(
    () => database.query(
      "update public.rental_documents set original_filename = 'tampered.pdf' where id = $1",
      [secondInsurance]
    ),
    "permission denied"
  );
  await resetRole(database);

  await expectDatabaseError(
    () => database.query("delete from public.rental_documents where id = $1", [firstInsurance]),
    "cannot be hard-deleted"
  );
  await expectDatabaseError(
    () => database.query(
      "delete from storage.objects where bucket_id = 'rental-documents' and name = $1",
      [objectPath(completeRequest, "insurance", "30000000-0000-4000-8000-000000000006")]
    ),
    "cannot be deleted or moved"
  );

  await setRole(database, "authenticated", {
    sub: staffId,
    app_metadata: { role: "staff" },
  });
  await expectDatabaseError(
    () => database.query("select public.finalize_rental_agreement($1::uuid)", [completeAgreement]),
    "Insurance must be verified"
  );
  await resetRole(database);

  assert.equal(
    await reviewInsurance(database, completeRequest, "verified", "Replacement reviewed"),
    secondInsurance
  );
  await setRole(database, "authenticated", {
    sub: staffId,
    app_metadata: { role: "staff" },
  });
  await expectDatabaseError(
    () => database.query("select public.finalize_rental_agreement($1::uuid)", [completeAgreement]),
    "acceptance evidence"
  );
  assert.equal(
    (await database.query("select count(*)::integer as count from public.rental_documents")).rows[0].count,
    8
  );
  await resetRole(database);

  await database.query(
    "update public.rental_agreements set status = 'ready', locked_at = now() where id = $1",
    [completeAgreement]
  );
  const postFinalizationPath = objectPath(
    completeRequest,
    "driver_license",
    "30000000-0000-4000-8000-000000000010"
  );
  await database.query(
    `insert into storage.objects (bucket_id, name, metadata)
     values ('rental-documents', $1, '{"size":5,"mimetype":"application/pdf"}'::jsonb)`,
    [postFinalizationPath]
  );
  await setRole(database, "authenticated", {
    sub: staffId,
    app_metadata: { role: "staff" },
  });
  await expectDatabaseError(
    () => database.query(
      `select public.register_rental_document(
        $1::uuid, 'driver_license', 'rental-documents', $2::text,
        'post-finalization.pdf', 'application/pdf', 5::bigint
      )`,
      [completeRequest, postFinalizationPath]
    ),
    "after Agreement finalization"
  );
  await resetRole(database);
  await database.query(
    "delete from storage.objects where bucket_id = 'rental-documents' and name = $1",
    [postFinalizationPath]
  );

  const edgeSource = await readFile(
    new URL("../../supabase/functions/rental-documents/index.ts", import.meta.url),
    "utf8"
  );
  assert.match(edgeSource, /app_metadata/);
  assert.doesNotMatch(edgeSource, /user_metadata/);
  assert.match(edgeSource, /crypto\.randomUUID\(\)/);
  assert.match(edgeSource, /createSignedUrl/);
  assert.match(edgeSource, /remove\(\[storagePath\]\)/);
  assert.doesNotMatch(edgeSource, /console\.(log|info|debug)/);

  await database.exec(documentMigration);
  assert.equal(
    (await database.query("select public from storage.buckets where id = 'rental-documents'")).rows[0].public,
    false
  );
});
