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
const sqlTestUrl = new URL("../../supabase/tests/multi_item_hardening.sql", import.meta.url);
const publicCatalogUrl = new URL("../../src/data/publicRentalCatalog.json", import.meta.url);

const createSupabaseLikeDatabase = async () => {
  const database = new PGlite({ extensions: { pgcrypto } });
  await database.exec(`
    create schema if not exists extensions;
    create extension if not exists pgcrypto with schema extensions;
  `);
  return database;
};

const requestPayload = {
  customer_type: "individual",
  full_name: "Release Foundation Test",
  phone: "8015550100",
  email: "foundation@example.test",
  fulfillment_type: "Pickup",
  project_type: "Regression validation",
  notes: "Automated fixture",
  agreement_accepted: true,
};

const isoDaysFromNow = (days) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(16, 0, 0, 0);
  return date.toISOString();
};

const bobcatItem = () => ({
  equipment_id: "bobcat-t550-skid-steer",
  start_date: isoDaysFromNow(5),
  end_date: isoDaysFromNow(7),
  quantity: 1,
  notes: "Track loader",
});

const createDatabase = async () => {
  const database = await createSupabaseLikeDatabase();
  await database.exec("create role anon nologin; create role authenticated nologin;");
  return database;
};

const applyMigration = async (database, index) => {
  await database.exec(await readFile(migrationUrls[index], "utf8"));
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

const createRequest = (database, payload = requestPayload, items = [bobcatItem()]) =>
  database.query(
    "select public.create_rental_request_with_items($1::jsonb, $2::jsonb) as id",
    [JSON.stringify(payload), JSON.stringify(items)]
  );

test("Release 1 migrations are secure at every step and rerunnable", async (t) => {
  const database = await createDatabase();
  t.after(() => database.close());

  const sqlSources = await Promise.all(
    [...migrationUrls, sqlTestUrl].map((url) => readFile(url, "utf8"))
  );
  const sqlCorpus = sqlSources.join("\n");
  assert.doesNotMatch(sqlCorpus, /\bpublic\.digest\s*\(/i);
  assert.doesNotMatch(sqlCorpus, /(^|[^.\w])digest\s*\(/im);
  assert.match(sqlCorpus, /extensions\.digest\s*\(/i);

  const agreementMigrationSql = sqlSources[2].toLowerCase();
  const pgcryptoSetupIndex = agreementMigrationSql.indexOf(
    "create extension if not exists pgcrypto with schema extensions"
  );
  const firstDigestUseIndex = agreementMigrationSql.indexOf("extensions.digest(");
  assert.ok(pgcryptoSetupIndex >= 0);
  assert.ok(firstDigestUseIndex > pgcryptoSetupIndex);

  const pgcryptoNamespace = await database.query(`
    select namespaces.nspname as schema_name
    from pg_catalog.pg_extension installed_extensions
    join pg_catalog.pg_namespace namespaces
      on namespaces.oid = installed_extensions.extnamespace
    where installed_extensions.extname = 'pgcrypto'
  `);
  assert.equal(pgcryptoNamespace.rows[0].schema_name, "extensions");

  await applyMigration(database, 0);

  const parentSecurity = await database.query(`
    select
      relrowsecurity as rls_enabled,
      has_table_privilege('authenticated', 'public.rental_requests', 'delete') as authenticated_delete,
      has_table_privilege('anon', 'public.rental_requests', 'select') as anon_select
    from pg_class where oid = 'public.rental_requests'::regclass
  `);
  assert.equal(parentSecurity.rows[0].rls_enabled, true);
  assert.equal(parentSecurity.rows[0].authenticated_delete, false);
  assert.equal(parentSecurity.rows[0].anon_select, false);

  await setRole(database, "anon");
  await database.query(`
    insert into public.rental_requests (
      full_name, phone, email, equipment_requested, rental_start_date,
      rental_end_date, pickup_date, return_date, rental_duration,
      fulfillment_type, project_type, notes, agreement_accepted, status,
      source, priority, payment_status, deposit_status, delivery_status,
      availability_status, availability_notes
    ) values (
      'Legacy Public', '8015550100', 'legacy-public@example.test', 'Plate Compactor',
      current_date + 2, current_date + 3, now() + interval '2 days',
      now() + interval '3 days', '1 day', 'Pickup', 'Test', null, true,
      'new', 'website', 'normal', 'unpaid', 'not_required', 'not_scheduled',
      'pending_review', null
    )
  `);
  await expectDatabaseError(
    () => database.query("select id from public.rental_requests"),
    "permission denied"
  );
  await resetRole(database);
  assert.equal(
    (await database.query("select count(*)::integer as count from public.rental_requests")).rows[0].count,
    1
  );

  for (const trustedRole of ["staff", "admin"]) {
    await setRole(database, "authenticated", { app_metadata: { role: trustedRole } });
    const visible = await database.query("select id from public.rental_requests");
    assert.equal(visible.rows.length, 1);
    await resetRole(database);
  }

  await setRole(database, "authenticated", {
    app_metadata: { app_role: "staff" },
  });
  assert.equal((await database.query("select id from public.rental_requests")).rows.length, 1);
  await resetRole(database);

  for (const untrustedClaims of [
    { app_metadata: { role: "customer" } },
    { user_metadata: { role: "staff" } },
    { app_role: "staff" },
  ]) {
    await setRole(database, "authenticated", untrustedClaims);
    assert.equal((await database.query("select id from public.rental_requests")).rows.length, 0);
    assert.equal(
      (await database.query("update public.rental_requests set notes = 'denied' returning id")).rows.length,
      0
    );
    await expectDatabaseError(
      () => database.query("delete from public.rental_requests"),
      "permission denied"
    );
    await resetRole(database);
  }

  await applyMigration(database, 1);
  await applyMigration(database, 2);
  await applyMigration(database, 3);

  const itemSecurity = await database.query(`
    select
      relrowsecurity as rls_enabled,
      has_table_privilege('authenticated', 'public.rental_request_items', 'insert') as can_insert,
      has_table_privilege('authenticated', 'public.rental_request_items', 'update') as can_update,
      has_table_privilege('authenticated', 'public.rental_request_items', 'delete') as can_delete
    from pg_class where oid = 'public.rental_request_items'::regclass
  `);
  assert.equal(itemSecurity.rows[0].rls_enabled, true);
  assert.equal(itemSecurity.rows[0].can_insert, false);
  assert.equal(itemSecurity.rows[0].can_update, false);
  assert.equal(itemSecurity.rows[0].can_delete, false);

  const rpcSecurity = await database.query(`
    select
      p.proname,
      p.proargnames,
      pg_get_function_result(p.oid) as result_type,
      p.prosecdef as security_definer,
      p.proconfig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'create_rental_request_with_items',
        'replace_rental_request_items',
        'get_rental_request_item_editability'
      )
    order by p.proname
  `);
  const createRpc = rpcSecurity.rows.find((row) => row.proname === "create_rental_request_with_items");
  const replaceRpc = rpcSecurity.rows.find((row) => row.proname === "replace_rental_request_items");
  assert.deepEqual(createRpc.proargnames, ["request_payload", "item_payloads"]);
  assert.equal(createRpc.result_type, "uuid");
  assert.deepEqual(replaceRpc.proargnames, [
    "target_rental_request_id",
    "item_payloads",
    "legacy_fields",
  ]);
  assert.equal(replaceRpc.result_type, "void");
  for (const rpc of rpcSecurity.rows) {
    assert.equal(rpc.security_definer, true);
    assert.deepEqual(rpc.proconfig, ["search_path=pg_catalog, public, private"]);
  }

  const grantsAndFk = await database.query(`
    select
      has_function_privilege('anon', 'public.create_rental_request_with_items(jsonb,jsonb)', 'execute') as anon_create,
      has_function_privilege('anon', 'public.replace_rental_request_items(uuid,jsonb,jsonb)', 'execute') as anon_replace,
      has_function_privilege('authenticated', 'public.replace_rental_request_items(uuid,jsonb,jsonb)', 'execute') as auth_replace,
      (
        select confdeltype = 'r'
        from pg_constraint
        where conrelid = 'public.rental_request_items'::regclass
          and conname = 'rental_request_items_rental_request_fk'
      ) as parent_delete_restrict
  `);
  assert.equal(grantsAndFk.rows[0].anon_create, true);
  assert.equal(grantsAndFk.rows[0].anon_replace, false);
  assert.equal(grantsAndFk.rows[0].auth_replace, true);
  assert.equal(grantsAndFk.rows[0].parent_delete_restrict, true);

  await setRole(database, "anon");
  await expectDatabaseError(() => createRequest(database), "not enabled");
  await resetRole(database);

  for (let index = 0; index < migrationUrls.length; index += 1) {
    await applyMigration(database, index);
  }
  const gate = await database.query(
    "select enabled from private.release_feature_flags where feature_key = 'multi_item_rental_requests'"
  );
  assert.equal(gate.rows[0].enabled, false);
});

test("RPCs enforce catalog, lifecycle, RLS, and transaction boundaries", async (t) => {
  const database = await createDatabase();
  t.after(() => database.close());
  await applyMigration(database, 0);
  await applyMigration(database, 1);
  await applyMigration(database, 2);
  await database.exec(`
    update private.release_feature_flags
    set enabled = true
    where feature_key = 'multi_item_rental_requests'
  `);

  await setRole(database, "anon");
  const created = await createRequest(database);
  const requestId = created.rows[0].id;
  assert.equal(typeof requestId, "string");

  for (const [payload, expected] of [
    [{ ...bobcatItem(), daily_rate: 1 }, "manipulated"],
    [{ ...bobcatItem(), equipment_name: "Fake" }, "manipulated"],
    [{ ...bobcatItem(), serial_number: "Fake" }, "manipulated"],
    [{ ...bobcatItem(), equipment_id: "rawmax-tilt-deck-22" }, "not available"],
    [{ ...bobcatItem(), equipment_id: "unknown-equipment" }, "unknown equipment"],
  ]) {
    await expectDatabaseError(() => createRequest(database, requestPayload, [payload]), expected);
  }
  await resetRole(database);

  const stored = await database.query(`
    select equipment_name, daily_rate::text, serial_number
    from public.rental_request_items where rental_request_id = $1
  `, [requestId]);
  assert.deepEqual(stored.rows[0], {
    equipment_name: "2024 Bobcat T550 Track Loader",
    daily_rate: "120.00",
    serial_number: "B57T133070",
  });

  await setRole(database, "authenticated", { app_metadata: { role: "customer" } });
  assert.equal((await database.query("select id from public.rental_request_items")).rows.length, 0);
  await expectDatabaseError(
    () => database.query(
      "select public.replace_rental_request_items($1::uuid, $2::jsonb, '{}'::jsonb)",
      [requestId, JSON.stringify([bobcatItem()])]
    ),
    "Staff authorization"
  );
  await expectDatabaseError(
    () => database.query(`
      insert into public.rental_request_items (
        rental_request_id, display_order, equipment_name, start_date, end_date
      ) values ($1, 9, 'Bypass', now(), now())
    `, [requestId]),
    "permission denied"
  );
  await resetRole(database);

  await setRole(database, "authenticated", { app_metadata: { role: "staff" } });
  assert.equal((await database.query("select id from public.rental_request_items")).rows.length, 1);
  await expectDatabaseError(
    () => database.query("update public.rental_request_items set notes = 'bypass'"),
    "permission denied"
  );
  const replacement = {
    equipment_id: "plate-compactor",
    start_date: isoDaysFromNow(6),
    end_date: isoDaysFromNow(9),
    quantity: 1,
    notes: "Replacement",
  };
  await database.query(
    "select public.replace_rental_request_items($1::uuid, $2::jsonb, '{}'::jsonb)",
    [requestId, JSON.stringify([replacement])]
  );
  await resetRole(database);
  assert.equal(
    (await database.query("select quote_amount::text as value from public.rental_requests where id = $1", [requestId])).rows[0].value,
    "180.00"
  );

  const legacyQuotes = [120, 425, 0, null, 333.33];
  for (const [index, quote] of legacyQuotes.entries()) {
    const legacy = await database.query(`
      insert into public.rental_requests (
        full_name, phone, email, equipment_requested, rental_start_date,
        rental_end_date, agreement_accepted, quote_amount
      ) values ('Legacy', '8015550100', $1, 'Historical item', current_date - 10,
        current_date - $2::integer, true, $3) returning id
    `, [`legacy-${index}@example.test`, index === 1 ? 5 : 9, quote]);
    await setRole(database, "authenticated", { app_metadata: { role: "staff" } });
    await database.query(
      "select public.replace_rental_request_items($1::uuid, $2::jsonb, '{}'::jsonb)",
      [legacy.rows[0].id, JSON.stringify([replacement])]
    );
    await resetRole(database);
    const result = await database.query(
      "select quote_amount::text as value from public.rental_requests where id = $1",
      [legacy.rows[0].id]
    );
    assert.equal(result.rows[0].value, quote === null ? null : quote.toFixed(2));
  }

  await database.exec(`
    create table public.invoices (
      id uuid primary key default gen_random_uuid(),
      rental_request_id uuid references public.rental_requests(id)
    );
  `);
  const locked = await database.query(`
    insert into public.rental_requests (
      full_name, phone, email, equipment_requested, agreement_accepted
    ) values ('Locked', '8015550100', 'locked@example.test', 'Plate', true) returning id
  `);
  await database.query(`
    insert into public.rental_agreements (
      rental_request_id, agreement_number, customer_name, customer_email,
      customer_phone, equipment_requested
    ) values ($1, 'TEST-LOCKED', 'Locked', 'locked@example.test',
      '8015550100', 'Plate')
  `, [locked.rows[0].id]);
  await setRole(database, "authenticated", { app_metadata: { role: "admin" } });
  await expectDatabaseError(
    () => database.query(
      "select public.replace_rental_request_items($1::uuid, $2::jsonb, '{}'::jsonb)",
      [locked.rows[0].id, JSON.stringify([replacement])]
    ),
    "Agreement exists"
  );
  await resetRole(database);
  await expectDatabaseError(
    () => database.query("delete from public.rental_requests where id = $1", [locked.rows[0].id]),
    "Agreements or Invoices"
  );

  const invoiced = await database.query(`
    insert into public.rental_requests (
      full_name, phone, email, equipment_requested, agreement_accepted
    ) values ('Invoiced', '8015550100', 'invoiced@example.test', 'Plate', true) returning id
  `);
  await database.query("insert into public.invoices (rental_request_id) values ($1)", [invoiced.rows[0].id]);
  await setRole(database, "authenticated", { app_metadata: { role: "staff" } });
  await expectDatabaseError(
    () => database.query(
      "select public.replace_rental_request_items($1::uuid, $2::jsonb, '{}'::jsonb)",
      [invoiced.rows[0].id, JSON.stringify([replacement])]
    ),
    "Invoice exists"
  );
  await resetRole(database);

  const nonEditable = await database.query(`
    insert into public.rental_requests (
      full_name, phone, email, equipment_requested, agreement_accepted, status
    ) values ('Confirmed', '8015550100', 'confirmed@example.test', 'Plate', true, 'confirmed')
    returning id
  `);
  await setRole(database, "authenticated", { app_metadata: { role: "staff" } });
  await expectDatabaseError(
    () => database.query(
      "select public.replace_rental_request_items($1::uuid, $2::jsonb, '{}'::jsonb)",
      [nonEditable.rows[0].id, JSON.stringify([replacement])]
    ),
    "only while the request is new"
  );
  await resetRole(database);
  await expectDatabaseError(
    () => database.query("delete from public.rental_requests where id = $1", [nonEditable.rows[0].id]),
    "Only new rental requests"
  );

  await expectDatabaseError(
    () => database.query("delete from public.rental_requests where id = $1", [requestId]),
    "foreign key|still referenced"
  );

  await database.exec(`
    create function public.reject_request_update_fixture()
    returns trigger language plpgsql as $$
    begin
      if old.email = 'foundation@example.test' then
        raise exception 'forced parent update failure';
      end if;
      return new;
    end;
    $$;
    create trigger reject_request_update_fixture
    before update on public.rental_requests
    for each row execute function public.reject_request_update_fixture();
  `);
  const beforeRollback = await database.query(
    "select equipment_id from public.rental_request_items where rental_request_id = $1",
    [requestId]
  );
  await setRole(database, "authenticated", { app_metadata: { role: "staff" } });
  await expectDatabaseError(
    () => database.query(
      "select public.replace_rental_request_items($1::uuid, $2::jsonb, '{}'::jsonb)",
      [requestId, JSON.stringify([{ ...replacement, equipment_id: "kobalt-hand-tamper" }])]
    ),
    "forced parent update failure"
  );
  await resetRole(database);
  const afterRollback = await database.query(
    "select equipment_id from public.rental_request_items where rental_request_id = $1",
    [requestId]
  );
  assert.deepEqual(afterRollback.rows, beforeRollback.rows);

  await database.exec(await readFile(sqlTestUrl, "utf8"));
});

test("public catalog projection matches the authoritative server seed", async (t) => {
  const database = await createDatabase();
  t.after(() => database.close());
  await applyMigration(database, 0);
  await applyMigration(database, 1);
  await applyMigration(database, 2);

  const publicCatalog = JSON.parse(await readFile(publicCatalogUrl, "utf8"));
  assert.equal(publicCatalog.some((item) => "serialNumber" in item || "serial_number" in item), false);

  const serverCatalog = await database.query(`
    select equipment_id as id, equipment_name as name, category, status,
      daily_rate::float8 as "dailyRate", featured, most_popular as "mostPopular"
    from private.rental_equipment_catalog order by equipment_id
  `);
  const clientProjection = publicCatalog
    .map(({ catalogOrder: _catalogOrder, ...item }) => item)
    .sort((left, right) => left.id.localeCompare(right.id));
  assert.deepEqual(clientProjection, serverCatalog.rows);

  assert.deepEqual(
    publicCatalog.filter((item) => item.featured && item.status === "active").map((item) => item.id),
    ["bobcat-t550-skid-steer", "wacker-rd12-roller"]
  );
  assert.equal(publicCatalog.find((item) => item.id === "wacker-rd12-roller").category, "Heavy Equipment");
  assert.equal(publicCatalog.find((item) => item.id === "bobcat-t550-skid-steer").dailyRate, 120);
  assert.equal(publicCatalog.filter((item) => item.status === "archived").every((item) => !item.featured), true);
});
