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
];

const createSupabaseLikeDatabase = async () => {
  const database = new PGlite({ extensions: { pgcrypto } });
  await database.exec(`
    create schema if not exists extensions;
    create extension if not exists pgcrypto with schema extensions;
  `);
  return database;
};

const isoDaysFromNow = (days) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(16, 0, 0, 0);
  return date.toISOString();
};

const requestPayload = {
  customer_type: "business",
  business_name: "Snapshot Construction LLC",
  full_name: "Jordan Snapshot",
  phone: "8015550199",
  email: "agreement@example.test",
  fulfillment_type: "Delivery",
  project_type: "Agreement persistence validation",
  notes: "Server-owned request",
  agreement_accepted: true,
};

const normalizedItems = () => [
  {
    equipment_id: "bobcat-t550-skid-steer",
    start_date: isoDaysFromNow(10),
    end_date: isoDaysFromNow(12),
    quantity: 1,
    notes: "Bobcat snapshot",
  },
  {
    equipment_id: "wacker-rd12-roller",
    start_date: isoDaysFromNow(14),
    end_date: isoDaysFromNow(17),
    quantity: 1,
    notes: "Roller snapshot",
  },
];

const createDatabase = async () => {
  const database = await createSupabaseLikeDatabase();
  await database.exec("create role anon nologin; create role authenticated nologin;");
  for (const migrationUrl of migrationUrls) {
    await database.exec(await readFile(migrationUrl, "utf8"));
  }
  await database.exec(`
    insert into public.agreement_clauses (
      clause_key, title, body, display_order, enabled, category, version
    ) values (
      'rental-responsibility', 'Rental Responsibility',
      'The renter accepts the approved Release 1 terms.', 0, true, 'general', 1
    )
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

const enableMultiItemGate = (database) =>
  database.exec(`
    update private.release_feature_flags
    set enabled = true
    where feature_key = 'multi_item_rental_requests'
  `);

const disableMultiItemGate = (database) =>
  database.exec(`
    update private.release_feature_flags
    set enabled = false
    where feature_key = 'multi_item_rental_requests'
  `);

const createNormalizedRequest = async (database, items = normalizedItems()) => {
  await setRole(database, "anon");
  const result = await database.query(
    "select public.create_rental_request_with_items($1::jsonb, $2::jsonb) as id",
    [JSON.stringify(requestPayload), JSON.stringify(items)]
  );
  await resetRole(database);
  const requestId = result.rows[0].id;
  await database.query(`
    update public.rental_requests
    set availability_status = 'available',
        insurance_verification_status = 'verified',
        billing_address = '100 Billing Way',
        service_address = '200 Job Site Road'
    where id = $1
  `, [requestId]);
  return requestId;
};

const createAgreement = async (database, requestId, role = "staff") => {
  await setRole(database, "authenticated", {
    app_metadata: { role },
    sub: "11111111-1111-4111-8111-111111111111",
  });
  const result = await database.query(
    "select public.create_rental_agreement_for_request($1::uuid) as id",
    [requestId]
  );
  await resetRole(database);
  return result.rows[0].id;
};

const recordAcceptance = async (database, agreementId) => {
  await setRole(database, "authenticated", {
    app_metadata: { role: "staff" },
    sub: "11111111-1111-4111-8111-111111111111",
  });
  await database.query(
    "select public.record_rental_agreement_acceptance($1::uuid, 'Jordan Snapshot', 'Owner', true, true)",
    [agreementId]
  );
  await resetRole(database);
};

const createLegacyRequest = async (database, label, startOffset = 30) => {
  const result = await database.query(`
    insert into public.rental_requests (
      full_name, phone, email, equipment_requested, rental_start_date,
      rental_end_date, agreement_accepted, quote_amount, availability_status,
      insurance_verification_status, status
    ) values (
      $1, '8015550100', $2, 'Legacy Lifecycle Item',
      current_date + $3::integer, current_date + $3::integer + 2,
      true, 240.00, 'available', 'verified', 'new'
    ) returning id
  `, [label, `${label.toLowerCase().replaceAll(" ", "-")}@example.test`, startOffset]);
  return result.rows[0].id;
};

test("normalized Agreement creation is authoritative, unique, immutable, and fully transactional", async (t) => {
  const database = await createDatabase();
  t.after(() => database.close());
  await enableMultiItemGate(database);
  const requestId = await createNormalizedRequest(database);
  const agreementId = await createAgreement(database, requestId);

  const aggregate = await database.query(`
    select agreement_number, customer_type, customer_name, business_name,
      billing_address, service_address, quote_amount::text, total_amount::text,
      insurance_verification_status, availability_confirmation_status,
      terms_version, snapshot_schema_version, current_snapshot_hash,
      terms_version = private.agreement_clause_snapshot_hash(clause_snapshot)
        as clause_hash_verified,
      jsonb_array_length(clause_snapshot) as clause_count
    from public.rental_agreements where id = $1
  `, [agreementId]);
  assert.match(aggregate.rows[0].agreement_number, /^UCR-\d{4}-\d{6}$/);
  assert.deepEqual(
    {
      customer_type: aggregate.rows[0].customer_type,
      customer_name: aggregate.rows[0].customer_name,
      business_name: aggregate.rows[0].business_name,
      billing_address: aggregate.rows[0].billing_address,
      service_address: aggregate.rows[0].service_address,
      quote_amount: aggregate.rows[0].quote_amount,
      total_amount: aggregate.rows[0].total_amount,
      insurance: aggregate.rows[0].insurance_verification_status,
      availability: aggregate.rows[0].availability_confirmation_status,
      snapshot_schema_version: aggregate.rows[0].snapshot_schema_version,
      clause_hash_verified: aggregate.rows[0].clause_hash_verified,
      clause_count: aggregate.rows[0].clause_count,
    },
    {
      customer_type: "business",
      customer_name: "Jordan Snapshot",
      business_name: "Snapshot Construction LLC",
      billing_address: "100 Billing Way",
      service_address: "200 Job Site Road",
      quote_amount: "780.00",
      total_amount: "780.00",
      insurance: "verified",
      availability: "available",
      snapshot_schema_version: 1,
      clause_hash_verified: true,
      clause_count: 1,
    }
  );
  assert.match(aggregate.rows[0].terms_version, /^sha256:[0-9a-f]{64}$/);
  assert.match(aggregate.rows[0].current_snapshot_hash, /^sha256:[0-9a-f]{64}$/);

  const items = await database.query(`
    select rental_request_item_id, equipment_name, serial_number,
      daily_rate::text, billable_days, line_total::text, display_order
    from public.agreement_items
    where rental_agreement_id = $1 order by display_order
  `, [agreementId]);
  assert.equal(items.rows.length, 2);
  assert.deepEqual(items.rows.map((item) => ({
    name: item.equipment_name,
    serial: item.serial_number,
    rate: item.daily_rate,
    days: item.billable_days,
    total: item.line_total,
    hasLineage: typeof item.rental_request_item_id === "string",
  })), [
    {
      name: "2024 Bobcat T550 Track Loader",
      serial: "B57T133070",
      rate: "120.00",
      days: 2,
      total: "240.00",
      hasLineage: true,
    },
    {
      name: "Wacker Neuson RD12 Roller",
      serial: "WNCRD12AEPUM06214",
      rate: "180.00",
      days: 3,
      total: "540.00",
      hasLineage: true,
    },
  ]);

  await setRole(database, "authenticated", { app_metadata: { role: "staff" } });
  await expectDatabaseError(
    () => database.query(
      "select public.create_rental_agreement_for_request($1::uuid)",
      [requestId]
    ),
    "already exists"
  );
  await expectDatabaseError(
    () => database.query(
      "select public.replace_rental_request_items($1::uuid, $2::jsonb, '{}'::jsonb)",
      [requestId, JSON.stringify(normalizedItems())]
    ),
    "Agreement exists"
  );
  await expectDatabaseError(
    () => database.query(`
      insert into public.agreement_items (
        rental_agreement_id, display_order, equipment_name, start_date,
        end_date, quantity, daily_rate, billable_days, line_total
      ) values ($1, 9, 'Bypass', now(), now(), 1, 1, 1, 1)
    `, [agreementId]),
    "permission denied"
  );
  await resetRole(database);

  await database.exec(`
    update private.rental_equipment_catalog
    set equipment_name = 'Changed Catalog Name', daily_rate = 999
    where equipment_id = 'bobcat-t550-skid-steer';
    update public.rental_request_items
    set equipment_name = 'Changed Request Name', daily_rate = 888
    where rental_request_id = '${requestId}'
      and equipment_id = 'bobcat-t550-skid-steer';
  `);
  const immutableSnapshot = await database.query(`
    select equipment_name, daily_rate::text
    from public.agreement_items
    where rental_agreement_id = $1 and display_order = 0
  `, [agreementId]);
  assert.deepEqual(immutableSnapshot.rows[0], {
    equipment_name: "2024 Bobcat T550 Track Loader",
    daily_rate: "120.00",
  });
  await expectDatabaseError(
    () => database.query(
      "update public.agreement_items set equipment_name = 'Mutation' where rental_agreement_id = $1",
      [agreementId]
    ),
    "immutable"
  );
  await expectDatabaseError(
    () => database.query(
      "delete from public.agreement_items where rental_agreement_id = $1",
      [agreementId]
    ),
    "immutable"
  );

  await setRole(database, "authenticated", {
    app_metadata: { role: "admin" },
    sub: "11111111-1111-4111-8111-111111111111",
  });
  await database.query(
    "select public.update_rental_agreement_financials($1::uuid, 100, 50, 25)",
    [agreementId]
  );
  await database.query(
    "select public.record_rental_agreement_acceptance($1::uuid, 'Jordan Snapshot', 'Owner', true, true)",
    [agreementId]
  );
  await database.query("select public.finalize_rental_agreement($1::uuid)", [agreementId]);
  await expectDatabaseError(
    () => database.query(
      "select public.update_rental_agreement_financials($1::uuid, 0, 0, 0)",
      [agreementId]
    ),
    "unlocked draft"
  );
  await resetRole(database);

  const finalized = await database.query(`
    select status, total_amount::text, signature_status,
      acceptance_acknowledged, credit_card_authorization_acknowledged,
      accepted_terms_version = terms_version as accepted_exact_version,
      signed_by::text, locked_at is not null as locked
    from public.rental_agreements where id = $1
  `, [agreementId]);
  assert.deepEqual(finalized.rows[0], {
    status: "ready",
    total_amount: "955.00",
    signature_status: "accepted",
    acceptance_acknowledged: true,
    credit_card_authorization_acknowledged: true,
    accepted_exact_version: true,
    signed_by: "11111111-1111-4111-8111-111111111111",
    locked: true,
  });
});

test("Agreement authorization, grants, fixed search paths, and locking enforce least privilege", async (t) => {
  const database = await createDatabase();
  t.after(() => database.close());

  const metadata = await database.query(`
    select p.proname, p.proargnames, pg_get_function_result(p.oid) as result_type,
      p.prosecdef as security_definer, p.proconfig, pg_get_functiondef(p.oid) as definition
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'create_rental_agreement_for_request',
      'update_rental_agreement_financials',
      'record_rental_agreement_acceptance',
      'finalize_rental_agreement'
    ) order by p.proname
  `);
  assert.equal(metadata.rows.length, 4);
  for (const rpc of metadata.rows) {
    assert.equal(rpc.security_definer, true);
    assert.deepEqual(rpc.proconfig, ["search_path=pg_catalog, public, private"]);
    assert.equal(rpc.result_type, "uuid");
  }
  const createRpc = metadata.rows.find((row) => row.proname === "create_rental_agreement_for_request");
  assert.deepEqual(createRpc.proargnames, ["target_rental_request_id"]);
  assert.match(createRpc.definition, /FOR UPDATE/i);
  assert.match(createRpc.definition, /assert_rental_request_agreement_eligible/i);
  assert.match(createRpc.definition, /assert_no_serialized_item_overlaps/i);
  assert.doesNotMatch(createRpc.definition, /equipment_name\s+(text|jsonb)/i);
  for (const functionName of [
    "record_rental_agreement_acceptance",
    "finalize_rental_agreement",
  ]) {
    const lifecycleRpc = metadata.rows.find((row) => row.proname === functionName);
    assert.match(lifecycleRpc.definition, /FOR UPDATE/i);
    assert.match(lifecycleRpc.definition, /assert_rental_request_agreement_eligible/i);
  }

  const privateSecurity = await database.query(`
    select p.proname, p.prosecdef as security_definer, p.proconfig,
      has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname in (
      'current_credit_card_authorization_terms',
      'agreement_clause_snapshot_hash',
      'assert_rental_request_agreement_eligible',
      'assert_no_serialized_item_overlaps',
      'authoritative_item_payloads',
      'rental_agreement_material_snapshot',
      'rental_agreement_snapshot_hash',
      'protect_rental_agreement_snapshot'
    ) order by p.proname
  `);
  assert.equal(privateSecurity.rows.length, 8);
  for (const helper of privateSecurity.rows) {
    assert.equal(helper.security_definer, true);
    assert.match(helper.proconfig[0], /^search_path=pg_catalog,/);
    assert.equal(helper.authenticated_execute, false);
  }

  const security = await database.query(`
    select
      has_function_privilege('anon', 'public.create_rental_agreement_for_request(uuid)', 'execute') as anon_execute,
      has_function_privilege('authenticated', 'public.create_rental_agreement_for_request(uuid)', 'execute') as auth_execute,
      has_table_privilege('authenticated', 'public.rental_agreements', 'insert') as agreement_insert,
      has_table_privilege('authenticated', 'public.rental_agreements', 'update') as agreement_update,
      has_table_privilege('authenticated', 'public.agreement_items', 'insert') as item_insert,
      has_table_privilege('authenticated', 'public.agreement_items', 'update') as item_update,
      has_table_privilege('authenticated', 'public.agreement_items', 'delete') as item_delete,
      (select relrowsecurity from pg_class where oid = 'public.rental_agreements'::regclass) as agreement_rls,
      (select relrowsecurity from pg_class where oid = 'public.agreement_items'::regclass) as item_rls
  `);
  assert.deepEqual(security.rows[0], {
    anon_execute: false,
    auth_execute: true,
    agreement_insert: false,
    agreement_update: false,
    item_insert: false,
    item_update: false,
    item_delete: false,
    agreement_rls: true,
    item_rls: true,
  });

  await setRole(database, "anon");
  await expectDatabaseError(
    () => database.query("select public.create_rental_agreement_for_request(gen_random_uuid())"),
    "permission denied"
  );
  await expectDatabaseError(
    () => database.query("select * from public.rental_agreements"),
    "permission denied"
  );
  await resetRole(database);

  await setRole(database, "authenticated", { app_metadata: { role: "customer" } });
  assert.equal((await database.query("select * from public.rental_agreements")).rows.length, 0);
  assert.equal((await database.query("select * from public.agreement_items")).rows.length, 0);
  await expectDatabaseError(
    () => database.query("select public.create_rental_agreement_for_request(gen_random_uuid())"),
    "Staff authorization"
  );
  await resetRole(database);
});

test("legacy compatibility, rollout gates, lifecycle gates, and rollback remain production-safe", async (t) => {
  const database = await createDatabase();
  t.after(() => database.close());

  const legacy = await database.query(`
    insert into public.rental_requests (
      full_name, phone, email, equipment_requested, rental_start_date,
      rental_end_date, rental_duration, agreement_accepted, quote_amount,
      availability_status, insurance_verification_status
    ) values (
      'Legacy Customer', '8015550100', 'legacy-agreement@example.test',
      'Historical Manually Priced Equipment', current_date - 10,
      current_date - 5, '5 days', true, 333.33, 'available', 'verified'
    ) returning id
  `);
  const legacyAgreementId = await createAgreement(database, legacy.rows[0].id);
  const legacyItem = await database.query(`
    select rental_request_item_id, equipment_id, equipment_name,
      daily_rate::text, line_total::text, quantity
    from public.agreement_items where rental_agreement_id = $1
  `, [legacyAgreementId]);
  assert.deepEqual(legacyItem.rows[0], {
    rental_request_item_id: null,
    equipment_id: null,
    equipment_name: "Historical Manually Priced Equipment",
    daily_rate: "0.00",
    line_total: "333.33",
    quantity: 1,
  });

  const historicalRequest = await database.query(`
    insert into public.rental_requests (
      full_name, phone, email, equipment_requested, rental_start_date,
      rental_end_date, agreement_accepted, quote_amount,
      availability_status, insurance_verification_status
    ) values (
      'Historical Draft', '8015550100', 'historical-draft@example.test',
      'Pre-Migration Equipment', current_date - 4, current_date - 2,
      true, 210.00, 'available', 'verified'
    ) returning id
  `);
  const historicalAgreement = await database.query(`
    insert into public.rental_agreements (
      rental_request_id, agreement_number, customer_name, customer_email,
      customer_phone, equipment_requested, rental_start_date,
      rental_end_date, rental_duration, quote_amount, total_amount
    ) values (
      $1, 'HISTORICAL-DRAFT-1', 'Historical Draft',
      'historical-draft@example.test', '8015550100',
      'Pre-Migration Equipment', current_date - 4, current_date - 2,
      '2 days', 210.00, 210.00
    ) returning id
  `, [historicalRequest.rows[0].id]);
  await setRole(database, "authenticated", {
    app_metadata: { role: "staff" },
    sub: "11111111-1111-4111-8111-111111111111",
  });
  await expectDatabaseError(
    () => database.query(
      "select public.record_rental_agreement_acceptance($1::uuid, 'Historical Draft', null, true, true)",
      [historicalAgreement.rows[0].id]
    ),
    "verified immutable snapshot"
  );
  await resetRole(database);
  const upgradedHistorical = await database.query(`
    select status, terms_version, snapshot_schema_version,
      current_snapshot_hash, accepted_snapshot_hash,
      jsonb_array_length(clause_snapshot) as clauses,
      (select count(*)::integer from public.agreement_items items
       where items.rental_agreement_id = agreements.id) as item_count
    from public.rental_agreements agreements where id = $1
  `, [historicalAgreement.rows[0].id]);
  assert.deepEqual(upgradedHistorical.rows[0], {
    status: "draft",
    terms_version: null,
    snapshot_schema_version: null,
    current_snapshot_hash: null,
    accepted_snapshot_hash: null,
    clauses: 0,
    item_count: 0,
  });

  await enableMultiItemGate(database);
  const gatedRequestId = await createNormalizedRequest(database, [normalizedItems()[0]]);
  await disableMultiItemGate(database);
  await setRole(database, "authenticated", { app_metadata: { role: "staff" } });
  await expectDatabaseError(
    () => database.query(
      "select public.create_rental_agreement_for_request($1::uuid)",
      [gatedRequestId]
    ),
    "not enabled"
  );
  await resetRole(database);
  assert.equal(
    (await database.query(
      "select count(*)::integer as count from public.rental_agreements where rental_request_id = $1",
      [gatedRequestId]
    )).rows[0].count,
    0
  );

  const prerequisites = [
    ["pending availability", "pending_review", "verified", "new", "Availability"],
    ["pending insurance", "available", "pending", "new", "Insurance"],
    ["closed lifecycle", "available", "verified", "completed", "status"],
  ];
  for (const [name, availability, insurance, status, expected] of prerequisites) {
    const request = await database.query(`
      insert into public.rental_requests (
        full_name, phone, email, equipment_requested, rental_start_date,
        rental_end_date, agreement_accepted, availability_status,
        insurance_verification_status, status
      ) values ($1, '8015550100', $2, 'Legacy Item', current_date + 2,
        current_date + 3, true, $3, $4, $5) returning id
    `, [name, `${name.replaceAll(" ", "-")}@example.test`, availability, insurance, status]);
    await setRole(database, "authenticated", { app_metadata: { role: "staff" } });
    await expectDatabaseError(
      () => database.query(
        "select public.create_rental_agreement_for_request($1::uuid)",
        [request.rows[0].id]
      ),
      expected
    );
    await resetRole(database);
  }

  const empty = await database.query(`
    insert into public.rental_requests (
      full_name, phone, email, equipment_requested, rental_start_date,
      rental_end_date, agreement_accepted, availability_status,
      insurance_verification_status
    ) values ('Empty', '8015550100', 'empty@example.test', '', current_date + 2,
      current_date + 3, true, 'available', 'verified') returning id
  `);
  await setRole(database, "authenticated", { app_metadata: { role: "staff" } });
  await expectDatabaseError(
    () => database.query(
      "select public.create_rental_agreement_for_request($1::uuid)",
      [empty.rows[0].id]
    ),
    "valid item"
  );
  await resetRole(database);

  await enableMultiItemGate(database);
  const rollbackRequestId = await createNormalizedRequest(database, [{
    ...normalizedItems()[0],
    notes: "ROLLBACK",
  }]);
  await database.exec(`
    create function public.reject_agreement_item_fixture()
    returns trigger language plpgsql as $$
    begin
      if new.notes = 'ROLLBACK' then
        raise exception 'forced Agreement item failure';
      end if;
      return new;
    end;
    $$;
    create trigger reject_agreement_item_fixture
    before insert on public.agreement_items
    for each row execute function public.reject_agreement_item_fixture();
  `);
  await setRole(database, "authenticated", { app_metadata: { role: "staff" } });
  await expectDatabaseError(
    () => database.query(
      "select public.create_rental_agreement_for_request($1::uuid)",
      [rollbackRequestId]
    ),
    "forced Agreement item failure"
  );
  await resetRole(database);
  assert.equal(
    (await database.query(
      "select count(*)::integer as count from public.rental_agreements where rental_request_id = $1",
      [rollbackRequestId]
    )).rows[0].count,
    0
  );
});

test("acceptance binds the exact complete material snapshot and makes it immutable", async (t) => {
  const database = await createDatabase();
  t.after(() => database.close());
  await enableMultiItemGate(database);

  const requestId = await createNormalizedRequest(database);
  const agreementId = await createAgreement(database, requestId);

  const initialHashes = await database.query(`
    select current_snapshot_hash,
      private.rental_agreement_snapshot_hash(id) as first_hash,
      private.rental_agreement_snapshot_hash(id) as second_hash
    from public.rental_agreements where id = $1
  `, [agreementId]);
  assert.match(initialHashes.rows[0].current_snapshot_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(initialHashes.rows[0].first_hash, initialHashes.rows[0].second_hash);
  assert.equal(initialHashes.rows[0].current_snapshot_hash, initialHashes.rows[0].first_hash);

  const storedClauses = await database.query(
    "select clause_snapshot, current_snapshot_hash from public.rental_agreements where id = $1",
    [agreementId]
  );
  await database.exec(`
    update public.agreement_clauses
    set body = 'A later clause-library revision that must not affect this Agreement.'
    where clause_key = 'rental-responsibility'
  `);
  const unchangedStoredSnapshot = await database.query(
    "select clause_snapshot, current_snapshot_hash from public.rental_agreements where id = $1",
    [agreementId]
  );
  assert.deepEqual(unchangedStoredSnapshot.rows[0], storedClauses.rows[0]);

  await setRole(database, "authenticated", { app_metadata: { role: "staff" } });
  await database.query(
    "select public.update_rental_agreement_financials($1::uuid, 125, 40, 17.25)",
    [agreementId]
  );
  await resetRole(database);

  const changedHash = await database.query(`
    select current_snapshot_hash
    from public.rental_agreements where id = $1
  `, [agreementId]);
  assert.notEqual(
    changedHash.rows[0].current_snapshot_hash,
    initialHashes.rows[0].current_snapshot_hash
  );

  await recordAcceptance(database, agreementId);
  const accepted = await database.query(`
    select current_snapshot_hash, accepted_snapshot_hash,
      accepted_terms_version, terms_version
    from public.rental_agreements where id = $1
  `, [agreementId]);
  assert.equal(accepted.rows[0].accepted_snapshot_hash, accepted.rows[0].current_snapshot_hash);
  assert.equal(accepted.rows[0].accepted_terms_version, accepted.rows[0].terms_version);

  await setRole(database, "authenticated", { app_metadata: { role: "staff" } });
  await expectDatabaseError(
    () => database.query(
      "select public.update_rental_agreement_financials($1::uuid, 0, 0, 0)",
      [agreementId]
    ),
    "Accepted Agreement material terms"
  );
  await resetRole(database);

  await expectDatabaseError(
    () => database.query(
      "update public.agreement_items set notes = 'changed' where rental_agreement_id = $1",
      [agreementId]
    ),
    "immutable"
  );
  await expectDatabaseError(
    () => database.query(
      "update public.rental_agreements set clause_snapshot = '[]'::jsonb where id = $1",
      [agreementId]
    ),
    "immutable"
  );

  await setRole(database, "authenticated", { app_metadata: { role: "staff" } });
  await database.query("select public.finalize_rental_agreement($1::uuid)", [agreementId]);
  await resetRole(database);
  assert.equal(
    (await database.query(
      "select status from public.rental_agreements where id = $1",
      [agreementId]
    )).rows[0].status,
    "ready"
  );

  for (const [label, offset, corruptedHash] of [
    ["Missing accepted hash", 40, null],
    ["Mismatched accepted hash", 50, `sha256:${"0".repeat(64)}`],
  ]) {
    const corruptionRequestId = await createLegacyRequest(database, label, offset);
    const corruptionAgreementId = await createAgreement(database, corruptionRequestId);
    await recordAcceptance(database, corruptionAgreementId);
    await database.exec("alter table public.rental_agreements disable trigger rental_agreements_protect_snapshot");
    await database.query(
      "update public.rental_agreements set accepted_snapshot_hash = $2 where id = $1",
      [corruptionAgreementId, corruptedHash]
    );
    await database.exec("alter table public.rental_agreements enable trigger rental_agreements_protect_snapshot");
    await setRole(database, "authenticated", { app_metadata: { role: "staff" } });
    await expectDatabaseError(
      () => database.query(
        "select public.finalize_rental_agreement($1::uuid)",
        [corruptionAgreementId]
      ),
      corruptedHash ? "does not match" : "acceptance evidence"
    );
    await resetRole(database);
  }
});

test("acceptance and finalization share authoritative request lifecycle eligibility", async (t) => {
  const database = await createDatabase();
  t.after(() => database.close());

  const beforeAcceptanceCases = [
    ["Cancelled before acceptance", "cancelled", 60],
    ["Completed before acceptance", "completed", 70],
  ];
  for (const [label, status, offset] of beforeAcceptanceCases) {
    const requestId = await createLegacyRequest(database, label, offset);
    const agreementId = await createAgreement(database, requestId);
    await database.query("update public.rental_requests set status = $2 where id = $1", [requestId, status]);
    await setRole(database, "authenticated", { app_metadata: { role: "staff" } });
    await expectDatabaseError(
      () => database.query(
        "select public.record_rental_agreement_acceptance($1::uuid, 'Lifecycle Signer', null, true, true)",
        [agreementId]
      ),
      "lifecycle status"
    );
    await resetRole(database);
  }

  const beforeFinalizationCases = [
    ["Cancelled before finalization", "cancelled", 80],
    ["Completed before finalization", "completed", 90],
  ];
  for (const [label, status, offset] of beforeFinalizationCases) {
    const requestId = await createLegacyRequest(database, label, offset);
    const agreementId = await createAgreement(database, requestId);
    await recordAcceptance(database, agreementId);
    await database.query("update public.rental_requests set status = $2 where id = $1", [requestId, status]);
    await setRole(database, "authenticated", { app_metadata: { role: "staff" } });
    await expectDatabaseError(
      () => database.query(
        "select public.finalize_rental_agreement($1::uuid)",
        [agreementId]
      ),
      "lifecycle status"
    );
    await resetRole(database);
  }

  const validRequestId = await createLegacyRequest(database, "Valid lifecycle", 100);
  const validAgreementId = await createAgreement(database, validRequestId);
  await recordAcceptance(database, validAgreementId);
  await setRole(database, "authenticated", { app_metadata: { role: "staff" } });
  await database.query("select public.finalize_rental_agreement($1::uuid)", [validAgreementId]);
  await resetRole(database);
});

test("serialized equipment overlap is rejected at request and Agreement boundaries", async (t) => {
  const database = await createDatabase();
  t.after(() => database.close());
  await enableMultiItemGate(database);

  const serializedItem = (start, end) => ({
    equipment_id: "bobcat-t550-skid-steer",
    start_date: isoDaysFromNow(start),
    end_date: isoDaysFromNow(end),
    quantity: 1,
  });
  const invalidSets = [
    [serializedItem(110, 114), serializedItem(110, 114)],
    [serializedItem(120, 124), serializedItem(122, 126)],
    [serializedItem(130, 140), serializedItem(132, 134)],
  ];

  for (const items of invalidSets) {
    await setRole(database, "anon");
    await expectDatabaseError(
      () => database.query(
        "select public.create_rental_request_with_items($1::jsonb, $2::jsonb)",
        [JSON.stringify(requestPayload), JSON.stringify(items)]
      ),
      "overlapping rental periods"
    );
    await resetRole(database);
  }

  await setRole(database, "anon");
  const sequential = await database.query(
    "select public.create_rental_request_with_items($1::jsonb, $2::jsonb) as id",
    [
      JSON.stringify(requestPayload),
      JSON.stringify([serializedItem(150, 152), serializedItem(153, 155)]),
    ]
  );
  const differentUnits = await database.query(
    "select public.create_rental_request_with_items($1::jsonb, $2::jsonb) as id",
    [
      JSON.stringify({ ...requestPayload, email: "different-unit@example.test" }),
      JSON.stringify([
        serializedItem(160, 164),
        {
          equipment_id: "wacker-rd12-roller",
          start_date: isoDaysFromNow(160),
          end_date: isoDaysFromNow(164),
          quantity: 1,
        },
      ]),
    ]
  );
  await expectDatabaseError(
    () => database.query(
      "select public.create_rental_request_with_items($1::jsonb, $2::jsonb)",
      [
        JSON.stringify({ ...requestPayload, email: "manipulated@example.test" }),
        JSON.stringify([{ ...serializedItem(170, 172), serial_number: "CLIENT" }]),
      ]
    ),
    "manipulated"
  );
  await resetRole(database);
  assert.ok(sequential.rows[0].id);
  assert.ok(differentUnits.rows[0].id);

  const replaceRequestId = await createNormalizedRequest(database, [serializedItem(180, 182)]);
  await setRole(database, "authenticated", { app_metadata: { role: "staff" } });
  await expectDatabaseError(
    () => database.query(
      "select public.replace_rental_request_items($1::uuid, $2::jsonb, '{}'::jsonb)",
      [replaceRequestId, JSON.stringify([serializedItem(180, 184), serializedItem(182, 186)])]
    ),
    "overlapping rental periods"
  );
  await resetRole(database);

  const defensiveRequest = await database.query(`
    insert into public.rental_requests (
      full_name, phone, email, equipment_requested, rental_start_date,
      rental_end_date, agreement_accepted, availability_status,
      insurance_verification_status, status
    ) values (
      'Defensive Boundary', '8015550100', 'defensive@example.test',
      '2024 Bobcat T550 Track Loader', current_date + 200,
      current_date + 206, true, 'available', 'verified', 'new'
    ) returning id
  `);
  await database.query(`
    insert into public.rental_request_items (
      rental_request_id, display_order, equipment_id, equipment_name,
      start_date, end_date, quantity, daily_rate, serial_number
    ) values
      ($1, 0, 'bobcat-t550-skid-steer', '2024 Bobcat T550 Track Loader',
       now() + interval '200 days', now() + interval '204 days', 1, 120, 'B57T133070'),
      ($1, 1, 'bobcat-t550-skid-steer', '2024 Bobcat T550 Track Loader',
       now() + interval '202 days', now() + interval '206 days', 1, 120, 'B57T133070')
  `, [defensiveRequest.rows[0].id]);
  await setRole(database, "authenticated", { app_metadata: { role: "staff" } });
  await expectDatabaseError(
    () => database.query(
      "select public.create_rental_agreement_for_request($1::uuid)",
      [defensiveRequest.rows[0].id]
    ),
    "overlapping rental periods"
  );
  await resetRole(database);
});

test("Agreement PDF preparation is persisted-snapshot-only", async () => {
  const pageSource = await readFile(
    new URL("../../src/pages/AgreementPage.tsx", import.meta.url),
    "utf8"
  );
  const generatorSource = await readFile(
    new URL("../../src/utils/generateAgreementPdf.tsx", import.meta.url),
    "utf8"
  );
  const pdfSource = await readFile(
    new URL("../../src/components/agreement/pdf/AgreementPdfDocument.tsx", import.meta.url),
    "utf8"
  );
  const adapterSource = await readFile(
    new URL("../../src/domain/adapters/supabaseRentalAgreementRepository.ts", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(pageSource, /getAgreementClauses/);
  assert.doesNotMatch(pageSource, /clause_snapshot\.length\s*>\s*0\s*\?/);
  assert.match(pageSource, /disabled=\{isGeneratingPdf \|\| !hasVerifiedSnapshot\}/);
  assert.match(generatorSource, /snapshot_availability\.status !== "verified"/);
  assert.doesNotMatch(generatorSource, /AgreementClause/);
  assert.match(pdfSource, /agreement\.clause_snapshot\.map/);
  assert.match(adapterSource, /status: "missing" as const/);
});

test("remediation migration preserves finalized historical Agreements without silent backfill", async (t) => {
  const database = await createSupabaseLikeDatabase();
  t.after(() => database.close());
  await database.exec("create role anon nologin; create role authenticated nologin;");
  for (const migrationUrl of migrationUrls.slice(0, -1)) {
    await database.exec(await readFile(migrationUrl, "utf8"));
  }

  const request = await database.query(`
    insert into public.rental_requests (
      full_name, phone, email, equipment_requested, rental_start_date,
      rental_end_date, agreement_accepted, availability_status,
      insurance_verification_status
    ) values (
      'Finalized Historical', '8015550100', 'finalized-history@example.test',
      'Historical Unit', current_date - 10, current_date - 5,
      true, 'available', 'verified'
    ) returning id
  `);
  const agreement = await database.query(`
    insert into public.rental_agreements (
      rental_request_id, agreement_number, status, customer_name,
      customer_email, customer_phone, equipment_requested,
      rental_start_date, rental_end_date, quote_amount, total_amount,
      signature_status, acceptance_acknowledged,
      credit_card_authorization_acknowledged, terms_version,
      clause_snapshot, clause_snapshot_created_at, signed_at, locked_at
    ) values (
      $1, 'HISTORICAL-FINAL-1', 'ready', 'Finalized Historical',
      'finalized-history@example.test', '8015550100', 'Historical Unit',
      current_date - 10, current_date - 5, 500, 500,
      'accepted', true, true, $2,
      '[{"id":"legacy","title":"Historical","body":"Stored historical wording","display_order":0}]'::jsonb,
      now() - interval '10 days', now() - interval '9 days', now() - interval '9 days'
    ) returning id
  `, [request.rows[0].id, `sha256:${"a".repeat(64)}`]);
  await database.query(`
    insert into public.agreement_items (
      rental_agreement_id, display_order, equipment_name, start_date,
      end_date, quantity, daily_rate, billable_days, line_total
    ) values ($1, 0, 'Historical Unit', now() - interval '10 days',
      now() - interval '5 days', 1, 100, 5, 500)
  `, [agreement.rows[0].id]);

  const remediation = await readFile(migrationUrls.at(-1), "utf8");
  await database.exec(remediation);
  await database.exec(remediation);

  const preserved = await database.query(`
    select snapshot_schema_version, current_snapshot_hash,
      accepted_snapshot_hash, credit_card_authorization_terms,
      clause_snapshot -> 0 ->> 'body' as clause_body, status,
      locked_at is not null as locked
    from public.rental_agreements where id = $1
  `, [agreement.rows[0].id]);
  assert.deepEqual(preserved.rows[0], {
    snapshot_schema_version: null,
    current_snapshot_hash: null,
    accepted_snapshot_hash: null,
    credit_card_authorization_terms: null,
    clause_body: "Stored historical wording",
    status: "ready",
    locked: true,
  });
});
