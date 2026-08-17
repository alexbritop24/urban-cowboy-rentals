# Urban Cowboy Rentals — Release 1 Readiness and Activation Runbook

## Current Release Status

Release 1 is **engineering-validated locally and in the isolated hosted preview; its database schema through `20260810000100` is deployed and integrity-verified in production, while the migration-dependent application remains undeployed and Release 1 is not approved or enabled for production activation**. The implemented chain is:

`Rental Request → normalized items → initial availability → Agreement draft → private documents → exact-current Utah driver-license review + insurance verification → acceptance/card authorization → finalized Agreement → Invoice → Payment → final availability → Approval → reversal/reapproval`

Commit `59acd8d` was pushed to `main`. Because the Supabase GitHub integration still had “Deploy to production” enabled, that push unexpectedly applied the pending migrations through `20260809000100` to production before the planned controlled deployment step. Read-only integrity checks proved that the known production history was preserved. This was a schema deployment incident, not Release 1 feature activation or approval. Migration `20260810000100` was later applied to production through a controlled, forward-only procedure and passed complete pre/post integrity verification. The migration-dependent application commit has not been pushed or deployed. The production backend rollout flag is verified `false`; the Vercel project has no `VITE_ENABLE_MULTI_ITEM_RENTAL_REQUESTS` variable, so future builds remain fail-closed; and the currently deployed production frontend retains the single legacy Equipment Requested dropdown. The client selected `invoice_paid`, but the production Approval payment policy intentionally remains `unconfigured` until controlled activation. Production authorization, dependent application deployment and artifact/browser verification, business/legal decisions, smoke testing, and activation sign-offs remain pending.

Detailed behavior remains defined in the [Release 1 specification](urban-cowboy-rentals-release-1-spec.md), [ERD](urban-cowboy-rentals-release-1-erd.md), [security/role contract](urban-cowboy-rentals-release-1-security-roles.md), and [Approval workflow](urban-cowboy-rentals-release-1-approval-workflow.md).

## Readiness Matrix

| Capability | Status | Evidence or remaining proof |
| --- | --- | --- |
| Multi-item request persistence | HOSTED VALIDATED | Transactional RPC, authoritative catalog, lifecycle guards, hosted synthetic workflow, and local migration tests pass; backend gate remains off. |
| Agreement creation/finalization | HOSTED VALIDATED | The retained preview proved the complete Utah-inclusive sequence: finalization failed while Utah review was pending, then succeeded after exact-current-document verification; immutable Agreement evidence remained exact. |
| Agreement snapshots | READY | Clause and complete-material SHA-256 hashes are persisted and locally verified. |
| Agreement PDF | READY | Uses persisted snapshot data; legacy unverifiable records fail closed. Browser PDF is intentionally interim. |
| Document upload | HOSTED VALIDATED | Hosted Edge Function uploads, type/signature validation, randomized paths, registration, and compensation cleanup pass. |
| Private Storage | HOSTED VALIDATED | Hosted bucket is private with the expected limits and authorization boundaries. |
| Signed document URLs | HOSTED VALIDATED | Hosted short-lived signed URL access and expiry behavior pass. |
| Insurance verification | HOSTED VALIDATED | Hosted review binds the exact current insurance document. |
| Utah driver-license verification | PRODUCTION SCHEMA DEPLOYED — APPLICATION PENDING | Preview migration, authorization/RLS, exact-document review, replacement reset/race, lifecycle rules, Approval gate, and a fresh end-to-end workflow passed. Production migration `20260810000100` is integrity-verified, but the dependent application, production authorization, and smoke test remain pending. |
| Invoice creation | HOSTED VALIDATED | Hosted Agreement-derived, idempotent original Invoice creation and snapshot lineage pass. |
| Invoice issuance | HOSTED VALIDATED | Hosted issuance locks the snapshot and preserves totals. |
| Payment | HOSTED VALIDATED | Hosted append-only payment recording produced the exact paid balance with no drift. |
| Approval checklist | HOSTED VALIDATED | Hosted server-derived gates, actionable reasons, and fail-closed policy behavior pass. |
| Initial availability | HOSTED VALIDATED | Hosted hash-bound inclusive-date checks pass. |
| Final availability | HOSTED VALIDATED | Hosted Approval races and direct sessions prove final recheck after deterministic resource locking. |
| Approval | HOSTED VALIDATED | Earlier resource/payment-policy races remain valid, and the retained preview additionally proved the Utah gate rejects an invalid current license transactionally before final availability or Approval evidence. |
| Approval reversal | HOSTED VALIDATED | Hosted append-only reversal, cancellation protection, and resource release pass. |
| Reapproval | HOSTED VALIDATED | Hosted reversal/reapproval re-ran every gate and created new final evidence. |
| Reconciliation migration | HOSTED VALIDATED | Preview application, immediate comparison, manual rerun, and second comparison passed; indexes, helper/functions, FKs, sequences, flags, policy, and all ten business snapshots remained correct. |
| Agreement creation serialization | HOSTED VALIDATED | Two independent post-reconciliation staff JWT sessions produced exactly one Agreement and one `23505` rejection for the same request. This is Agreement creation evidence, not a rerun of the Approval race suite. |
| Legacy compatibility | READY — HOSTED UI EVIDENCE PARTIAL | Local request/Agreement/Invoice/route coverage passes, and production database preservation of all known legacy rows is verified. Preview contained no representative historical Agreements or Invoices, so hosted legacy route rendering and `legacy_unverified` presentation remain untested. |
| Authorization/RLS | PREVIEW VALIDATED — PRODUCTION PARTIAL | Refreshed preview staff/admin sessions passed the Utah capability, review, and append-only-history workflow; customer and spoofed-customer sessions were denied. Jason's production admin role passed a limited read-only check, while the personal staff session and migration-dependent production authorization remain pending. |
| Production schema | DEPLOYED — NOT ACTIVATED | Migrations through `20260809000100` were applied automatically by the GitHub integration; `20260810000100` was then applied and verified through a controlled procedure. Preservation checks passed; no application rollout, production smoke test, or feature activation occurred. |
| Production rollout gates | DISABLED | Production database flag is verified `false`; Vercel has no browser-gate variable, so future builds resolve fail-closed; and the deployed frontend retains the single legacy Equipment Requested dropdown. Backend activation must precede browser exposure. |

No current item is classified `BLOCKED — ENGINEERING`. Preview reconciliation, migration `20260810000100` compatibility/idempotency, controlled production schema application and integrity verification, Utah authorization and lifecycle validation, the replacement/review race, the fresh Utah-inclusive workflow, and independent-session Agreement creation serialization are complete. Production activation remains blocked by dependent application deployment, production authorization and artifact/browser verification, remaining decisions and operational verification, approved smoke testing, and explicit acceptance of the partial hosted legacy-route evidence.

## Hosted Validation Harness

The repository provides `npm run test:hosted -- <command>`. It uses the existing Supabase client and adds no testing framework. It never prints credential values or customer data. Hosted authorization must run under Node 22 with native WebSocket support; Node 20 could not execute that check correctly. The successful post-reconciliation authorization run used Node 22.23.1 and securely refreshed JWTs without printing token values or identity details.

The harness refuses every hosted target unless:

- `RELEASE_VALIDATION_ENVIRONMENT=preview`;
- `RELEASE_VALIDATION_CONFIRM_PROJECT_REF` exactly matches the project reference parsed from `VITE_SUPABASE_URL`; and
- mutating commands also set `RELEASE_VALIDATION_ALLOW_MUTATIONS=YES_I_UNDERSTAND_PREVIEW_ONLY`.

Do not set these confirmations for production. Use the isolated hosted preview for preview-only validation. Synthetic records remain auditable and must not be removed by bypassing application retention guards. Retain the current validation database and project as evidence through the remaining release decisions and production verification; this readiness update does not recommend deletion or reset.

### Required hosted variables

Values belong in a secure shell/CI secret store, never Git. Only names are listed here.

| Variable | Used for |
| --- | --- |
| `VITE_SUPABASE_URL` | Confirmed hosted preview URL. |
| `VITE_SUPABASE_ANON_KEY` | Public project key used by all test clients. |
| `SUPABASE_SERVICE_ROLE_KEY` | Document bucket inspection and compensation verification; server-side test process only. |
| `RELEASE_VALIDATION_ENVIRONMENT` | Must be `preview`. |
| `RELEASE_VALIDATION_CONFIRM_PROJECT_REF` | Exact preview project-reference confirmation. |
| `RELEASE_VALIDATION_ALLOW_MUTATIONS` | Explicit preview-only mutation confirmation. |
| `RELEASE_VALIDATION_STAFF_ACCESS_TOKEN` | Trusted `app_metadata` staff JWT. |
| `RELEASE_VALIDATION_STAFF_2_ACCESS_TOKEN` | Independent trusted staff JWT/session for races. |
| `RELEASE_VALIDATION_ADMIN_ACCESS_TOKEN` | Trusted `app_metadata` admin JWT. |
| `RELEASE_VALIDATION_CUSTOMER_ACCESS_TOKEN` | Ordinary authenticated customer JWT. |
| `RELEASE_VALIDATION_SPOOFED_CUSTOMER_ACCESS_TOKEN` | Customer JWT with only spoofed `user_metadata` staff data. |
| `RELEASE_VALIDATION_DATABASE_URL` | Direct preview PostgreSQL connection for controlled transaction tests; not consumed by the Node harness. |

Fixture variables are `RELEASE_VALIDATION_FAIL_CLOSED_REQUEST_ID`, `RELEASE_VALIDATION_DOCUMENT_REQUEST_ID`, `RELEASE_VALIDATION_SAME_RESOURCE_REQUEST_A/B`, `RELEASE_VALIDATION_MULTI_RESOURCE_REQUEST_A/B`, and `RELEASE_VALIDATION_DISJOINT_REQUEST_A/B`.

Run safely after exporting variables from an untracked secure source:

```bash
npm run test:hosted -- preflight
npm run test:hosted -- authorization
npm run test:hosted -- fail-closed
npm run test:hosted -- documents
npm run test:hosted -- approval-races
```

`authorization` uses nonexistent UUIDs and does not write valid business records. `fail-closed`, `documents`, and `approval-races` require the mutation confirmation because they exercise write paths in the isolated preview.

### Fixture requirements

- The fail-closed fixture must satisfy every Approval prerequisite except the intentionally `unconfigured` payment policy.
- The document fixture must be an unfinalized synthetic request so staff/admin can register generated license and insurance files.
- Same-resource fixtures must contain the same serialized unit and overlapping dates.
- Multi-resource A must contain X then Y; B must contain Y then X, with overlapping dates.
- Disjoint fixtures must use completely different resource keys.
- Every race fixture must be `pending`, have no Approved event, and satisfy every gate under the temporary isolated-preview policy selected for that test.
- Never use real customer names, email addresses, identity documents, or insurance files.

## Hosted Test Procedures

The following procedures remain the reusable validation protocol. They were completed where the hosted validation record below reports a pass; imperative steps describe how to repeat that evidence and do not indicate an outstanding preview gate.

### 1. Migration compatibility

Create a new hosted preview from the base schema and apply migrations in filename order. Do not rewrite merged migrations. Verify:

1. the first Agreement migration creates `extensions` and installs `pgcrypto` before the first `extensions.digest` use;
2. no migration contains `public.digest`;
3. no application migration takes ownership of or enables/disables RLS structurally on `storage.objects`;
4. no unsafe ownership DDL targets `storage`, `auth`, or `realtime`;
5. every SECURITY DEFINER function has its committed fixed `search_path`;
6. public RPC grants, table grants, and RLS match the role matrix;
7. the `rental-documents` bucket remains private; and
8. the repository's documented clean/sequential/rerun strategy passes.

A defect in a migration already merged to `main` requires a new forward-only remediation migration. Never edit deployed history.

### 2. Fail-closed policy

With the global policy still `unconfigured`, run `fail-closed`. Expected: checklist `configuration_required`, Approval error, unchanged request Approval state, and no Approved event. This is a pass condition.

### 3. Approval races

After the fail-closed test, a database administrator may temporarily select the client-approved test policy **only in the isolated preview**. Prepare fresh fixtures, run `approval-races`, record sanitized output, and restore the policy to `unconfigured` immediately afterward.

The Node race proves final outcomes. For deterministic lock-wait evidence, use two direct PostgreSQL sessions. Session A begins a transaction, sets trusted synthetic staff claims, calls `approve_rental_request()`, and holds the transaction open. Session B calls Approval for its conflicting fixture and must wait until Session A commits. The waiting call must then return `availability_conflict`. Repeat for X+Y versus Y+X. For disjoint resources, Session B must complete while Session A remains open.

Use the same session preamble with a synthetic staff UUID:

```sql
begin;
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"<synthetic-staff-uuid>","app_metadata":{"role":"staff"}}',
  true
);
```

Session A then runs:

```sql
select public.approve_rental_request('<request-a>', 'Hosted lock validation');
select pg_catalog.pg_sleep(15);
commit;
```

Start Session B during the sleep:

```sql
begin;
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"<second-synthetic-staff-uuid>","app_metadata":{"role":"staff"}}',
  true
);
select public.approve_rental_request('<request-b>', 'Hosted waiter validation');
commit;
```

Capture elapsed time and sanitized result codes only. Inspect `rental_requests`, `rental_approval_events`, and final `rental_availability_checks`: exactly one conflicting fixture is Approved, and the loser has no Approval actor/time or Approved event.

### 4. Payment-policy serialization

Use a fresh fixture eligible under the current isolated-preview test policy. Session A calls Approval and sleeps before commit as above. While it sleeps, a database-administrator Session B runs:

```sql
begin;
update private.rental_approval_configuration
set configuration_value = '<alternate-valid-policy>', updated_at = now()
where configuration_key = 'payment_policy';
commit;
```

The UPDATE must wait for Session A's `FOR SHARE` policy-row lock. The successful Approved event must retain the policy evaluated by Session A. After evidence is captured, restore the preview configuration explicitly:

```sql
update private.rental_approval_configuration
set configuration_value = 'unconfigured', updated_at = now()
where configuration_key = 'payment_policy';
```

Do not run this procedure against production and do not expose the database URL or results containing customer data.

### 5. Private documents

Run `documents` against the unfinalized synthetic request. It verifies:

- private bucket, 10 MB limit, and PDF/JPEG/PNG allowlist;
- anon, customer, and `user_metadata` spoof upload denial;
- staff/admin generated synthetic uploads;
- empty, forged, mismatched, and oversized rejection;
- randomized server paths with no filename/PII;
- unauthenticated public URL denial;
- current-document-bound signed URL creation and arbitrary-ID denial; and
- upload-success/registration-failure compensation without deleting existing registered metadata.

The response TTL is checked against the 60–300 second bound and the URL is read during that window. A wall-clock request after expiry must also be included in the hosted evidence because the harness intentionally does not pause automated execution for several minutes.

The known non-blocking limitation remains: if the compensation deletion itself fails, the Edge Function reports operator cleanup but does not persist a durable orphan-cleanup job or metric.

### 6. Edge Function deployment check

Deploy `rental-documents` from the committed source with JWT verification enabled. Confirm the bundle resolves the shared validator import. Hosted runtime configuration must supply `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`; optional `RENTAL_DOCUMENT_MAX_BYTES` and `RENTAL_DOCUMENT_SIGNED_URL_TTL_SECONDS` must match the approved values.

## Authorization Matrix

| Operation | anon | customer | staff | admin | Source of authority |
| --- | --- | --- | --- | --- | --- |
| Document metadata read | Deny | Deny | Allow | Allow | RLS + `private.is_staff()` |
| Signed document access | Deny | Deny | Allow current document | Allow current document | Edge JWT + metadata RLS |
| Driver-license review/history | Deny | Deny | Allow exact-current document | Allow exact-current document | Staff RPC + RLS; only `UT` may be verified |
| Insurance review | Deny | Deny | Allow | Allow | Staff RPC |
| Agreement finalization | Deny | Deny | Allow when gates pass | Allow when gates pass | Staff RPC |
| Invoice create/issue | Deny | Deny | Allow | Allow | Staff RPC |
| Payment recording | Deny | Deny | Allow | Allow | Staff RPC |
| Initial availability | Deny | Deny | Allow | Allow | Staff RPC |
| Approval | Deny | Deny | Allow when every gate passes | Allow when every gate passes | Staff RPC |
| Reversal | Deny | Deny | Allow for Approved rental | Allow for Approved rental | Staff RPC |

Only `app_metadata.role` or `app_metadata.app_role` values `staff`/`admin` are trusted. A customer-controlled `user_metadata` value never grants authority.

## Synthetic End-to-End Walkthrough

The pre-Utah Release 1 baseline form of this walkthrough passed in the isolated hosted preview and remains valid historical evidence. After preview application of migration `20260810000100`, a fresh revised walkthrough including exact-current-document Utah driver-license verification also passed in retained preview project `cmqsvywbhswrycgxvbgy`. This is hosted preview backend/workflow evidence only: production now has the integrity-verified schema migration, but the revised application UI has not been deployed or browser-tested there. Retain the procedure and preview evidence for review and any approved production smoke test. Use active serialized catalog items and synthetic customer data only.

For Release 1, customers send their driver license and insurance to staff, and trusted staff/admin upload both through the protected dashboard. Direct customer document upload remains deferred to Release 1.1.

1. Enable the backend gate temporarily in the isolated preview—not production—and create a multi-item request through `create_rental_request_with_items()`.
2. Confirm normalized child rows, independent dates/rates, quantity `1`, authoritative names/serials/rates, and legacy scalar summary.
3. Confirm initial availability.
4. Create the Agreement and verify its item/clause/material snapshots and `sha256:` hashes.
5. Record typed-name acceptance and credit-card authorization acknowledgment; never submit card number or CVV.
6. Run the document harness or upload generated license/insurance files. Inspect the exact current driver-license document, submit that document ID to the manual review RPC, verify it only when Utah-issued, and independently verify the current insurance document.
7. Finalize the Agreement and confirm immutable status/hash evidence.
8. Create exactly one original Invoice, issue it, and verify snapshot lineage.
9. Record a valid synthetic Payment only when required by the isolated-preview policy.
10. Inspect the checklist. With `unconfigured`, stop and record the correct fail-closed result.
11. In a separate isolated-policy test, approve, verify the Approved event/final availability evidence, reverse, confirm every dependent record remains, and reapprove after all gates pass again.
12. Restore the payment policy and backend gate to disabled defaults. Retain the current isolated preview until this readiness documentation is reviewed and remaining release decisions and production verification are complete.

The browser gate remains off throughout backend walkthroughs. It is not necessary to expose unfinished behavior to test trusted RPCs.

The review RPC rejects stale operator intent: if the inspected license has been replaced, the expected document ID no longer matches and no review event is created. Verification can never be introduced after Agreement finalization. A locked but never-Approved rental may record rejection because no Approval exists to reverse. A currently Approved rental must first use the audited reversal workflow; rejection never unlocks or rewrites the Agreement, and the rejected locked Agreement cannot silently regain eligibility.

## Inclusive Dates, Cancellation, and Legacy Walkthroughs

Inclusive-date hosted validation passed with one serialized unit for August 10–12, a conflicting August 12–14 request, and an available August 13–14 request. The public legacy RPC, initial confirmation, final Approval, and browser advisory agreed.

Cancellation protection also passed: directly setting an Approved request to `cancelled` failed. After `reverse_rental_approval()`, operational cancellation succeeded and the reversed rental no longer blocked solely because of its former Approval. Approved and Reversed events remained append-only.

The preview's only request without `rental_request_items` was `61d9c74e-7b1a-4464-ad2b-c4f06f38a9cd`. Inspection proved that it is an obsolete synthetic document-validation fixture, not representative business history:

- `full_name` is `Synthetic Release Validation`;
- its generated email identifies an `r1-doc` test, and its phone is a placeholder;
- `equipment_requested` explicitly identifies a synthetic document fixture;
- it has no rental dates, normalized items, Agreement, Invoice, Payment, availability history, or Approval history; and
- it has two tiny synthetic document files with matching private Storage objects.

This fixture does not reveal a Release 1 defect and must not be backfilled. It remains in the preview as retained validation evidence.

The hosted preview contained zero representative historical legacy Agreements and zero representative historical legacy Invoices. Hosted rendering of `/admin/agreement/:id` and `/invoice/:id`, including `legacy_unverified` presentation, was therefore **not testable** and is not claimed as a hosted pass. Local automated legacy compatibility coverage passes. The subsequent production read-only inventory proved database-level preservation of the actual historical Agreements and Invoices, but it did not test their browser routes or UI presentation. Do not backfill, mutate, or fabricate records merely to expand validation evidence.

## Local Production-Shape Compatibility Remediation

Local production-shape remediation was completed on 2026-08-14 against the read-only production inventory documented for this review. Commit `59acd8d fix(migrations): preserve legacy agreement history` is pushed to `main`; the repository was clean and synchronized before this documentation update.

- The first unapplied Agreement migration now permits retained historical draft duplicates while enforcing at most one canonical active Agreement per request.
- Historical draft and ready/locked Agreements remain unchanged. No signature, acceptance, clause, item, Approval, Payment, or availability evidence is fabricated.
- Agreement lookup and Approval selection use the same deterministic canonical ordering, preferring locked ready/signed records over drafts.
- A new forward-only reconciliation migration converges already-migrated environments without deleting or rewriting business rows.
- The four legacy Agreement/Invoice/Payment foreign keys are replaced semantically with validated `RESTRICT` constraints; the existing `rental_request_items` `RESTRICT` relationship remains intact.
- Agreement and Invoice numbering sequences advance beyond the largest matching persisted suffix and never regress.
- A local production-shaped fixture preserves three request IDs, 17 Agreements including 14 retained drafts, two issued/unpaid legacy Invoices without invented item snapshots, archived-equipment scalar history, totals, balances, statuses, and timestamps.

The local validation associated with `59acd8d` passed before hosted reconciliation: production compatibility 3/3, behavioral Agreement repository 1/1, persistence 34/34, lint, 45-file domain analysis with zero cycles, both feature-gate builds, and `git diff --check`. Embedded PGlite was not treated as independent-session evidence. The later hosted preview reconciliation, idempotency, authorization, and same-request Agreement creation race are recorded below.

## Hosted Reconciliation, Production Schema Incident, and Containment

### Preview reconciliation and idempotency

The `urban-cowboy-rentals-r1-validation` project (`cmqsvywbhswrycgxvbgy`) was at migration `20260808000100` before reconciliation. It had the old unconditional `rental_agreements_rental_request_key`, no canonical Agreement helper, request-level Agreement selection in Approval/checklist, no conflicting active or Release 1 Agreement cardinality, backend flag `false`, and payment policy `unconfigured`.

The linked CLI dry run identified only `20260809000100_release1_production_shape_reconciliation.sql` as pending. Applying it to preview succeeded. Post-migration inspection proved:

- migration `20260809000100` is recorded as latest;
- the unconditional Agreement index is gone and both intended partial unique indexes are present;
- `private.canonical_rental_agreement_id(uuid)` exists and both Approval/checklist functions use it;
- all five intended foreign keys are validated `RESTRICT` constraints;
- Agreement and Invoice sequences remained at `8` and did not regress;
- the backend flag remained `false` and payment policy remained `unconfigured`; and
- all ten recorded business-table counts and hashes matched their pre-migration values, with `all_business_snapshots_match = true`.

A following CLI dry run reported that the remote database was up to date. The reconciliation SQL was then manually applied a second time in preview and completed successfully with no returned rows. Immediate comparison again proved all ten business hashes/counts, both sequences, partial indexes, five validated `RESTRICT` foreign keys, canonical helper/function integration, rollout flag, and payment policy remained correct. This is hosted idempotency evidence.

### Post-reconciliation authorization and Agreement creation race

The first authorization attempt under Node 20 was invalid because native WebSocket support was unavailable. The operator switched to Node 22.23.1, securely refreshed expired preview JWTs without printing secrets, and reconfirmed the staff, second-staff, admin, customer, and spoofed-customer claim classes. `npm run test:hosted -- authorization` then passed.

No existing request was suitable for a same-request Agreement creation race, so a clearly labeled preview-only scalar compatibility fixture was created:

- request `e9b3d4a1-22c7-4ee5-bf51-202608150001`;
- status `new`, Approval `pending`, availability `available`, and insurance `verified`;
- dates January 10–12, 2030 and quote `$240.00`; and
- no Agreement before the race.

The fixture's `insurance_verification_status = verified` prerequisite was established through privileged, controlled preview-only SQL setup. That setup was acceptable only in the disposable validation project; it was not a new test of document upload, insurance review, or production authorization. Earlier hosted document and insurance workflow evidence remains separate from this race.

Two distinct valid staff JWT sessions simultaneously called `create_rental_agreement_for_request(uuid)`. Exactly one succeeded and one was rejected with PostgreSQL code `23505`. The resulting authoritative Agreement is `b345bcef-b323-470a-8c4d-d8b2f6bab0f5`, number `UCR-2026-000009`, status `draft`, with `snapshot_schema_version = 1`, a present current snapshot hash, and exactly one Agreement item.

This race tested and proves post-reconciliation independent-session serialization for same-request Agreement creation only. It is not a post-reconciliation Approval race; the broader Approval race suite was completed on the prior preview schema. The idempotency hash comparison occurred before this intentional fixture was created, so the original whole-database hashes are not claimed to remain unchanged afterward.

### Utah verification migration and hosted validation

Migration `20260810000100_utah_driver_license_verification.sql` was first applied and safely reapplied in retained preview project `cmqsvywbhswrycgxvbgy`. Pre-migration project identity and business-table hashes were captured. After application, business rows, hashes, and sequence values were preserved, while the expected schema, exact-document RPCs, lifecycle triggers, restrictive validated foreign keys, RLS policies, and append-only review history were present. The following linked dry run reported the remote preview database was up to date. The preview project must be retained as validation evidence. The later controlled production application and its independent preservation evidence are recorded below.

Hosted preflight passed under Node.js 22. After role-correct tokens were refreshed securely, the existing authorization matrix and the Utah-specific workflow passed without printing secrets:

- trusted staff and admin could load workflow capabilities, review the exact current license, and read append-only driver-license review history;
- ordinary customer and spoofed-customer sessions were denied the capability/review workflow and saw zero review-history rows;
- non-Utah verification was rejected;
- a review naming a stale or replaced document UUID was rejected without changing compliance state; and
- authorized Utah verification normalized the issuing state to `UT` and recorded the exact current document UUID and trusted actor.

Replacement and concurrency validation proved that registration created exactly one new current driver-license document, retired the previous document, reset the request to `pending`, cleared current verification evidence, and preserved prior review history. In the two-session hosted replacement/review race, request-first locking serialized the outcome as review-before-replacement followed by the authoritative reset to pending. No stale decision remained attached to the new current document.

Hosted lifecycle validation also passed:

- a locked but never-Approved Agreement allowed an out-of-state rejection without changing the locked Agreement or Approval history;
- an Approved rental rejected the same action until audited reversal;
- after reversal, out-of-state rejection succeeded while documents and the locked Agreement remained unchanged and both append-only histories were preserved; and
- the primary Approval RPC rejected a rejected/non-Utah current license before final availability or Approval evidence. The failure rolled back transactionally, leaving the request, documents, Agreement, Invoice, Payment, availability history, Approval history, and license-review history unchanged.

The fresh Utah-inclusive preview workflow used these retained identifiers:

| Record | Identifier |
| --- | --- |
| Rental Request | `0dd094d6-258d-4be3-942f-87c783f97e04` |
| Agreement | `130faff2-3cd6-4565-af49-860c47888117` (`UCR-2026-000010`) |
| Invoice | `83629836-4a4d-427b-a8b0-0eade34590ae` (`INV-2026-000009`) |
| Approval event | `12c1f6eb-12eb-4568-a6e7-ab822b52c7a6` |
| Final availability check | `b548e251-8887-48f7-a2e1-1c0a07b83049` |

The preview-only flow proved:

- one normalized `bobcat-t550-skid-steer` item for the serialized 2024 Bobcat T550 Track Loader, serial `B57T133070`, June 10–12, 2028, quantity `1`, `$120` daily rate, two billable days, and `$240` total;
- authoritative initial availability passed with a schedule hash and append-only evidence;
- trusted staff/admin uploaded synthetic driver-license and insurance PNG documents with distinct document IDs through the deployed Edge Function into private Storage with accepted signatures/MIME types and trusted uploader attribution; upload fabricated no verification evidence;
- insurance verification bound to the exact current insurance document;
- Agreement creation used a controlled temporary multi-item flag change, after which the flag was restored to `false`;
- acceptance and credit-card authorization acknowledgment were recorded; finalization correctly failed while Utah verification was pending, then succeeded after the trusted preview admin verified the exact current license as `UT`;
- Agreement `UCR-2026-000010` became ready and locked with snapshot schema version `1`, matching current/accepted hashes, and one immutable `$240` Agreement item;
- one original rental Invoice, `INV-2026-000009`, was derived from the accepted Agreement snapshot with one immutable `$240` item, issued, and paid in full by a `$240` card Payment, producing paid status and `$0` balance;
- the controlled Approval transaction temporarily used `invoice_paid`, returned final availability `available`, matched the initial and final schedule hashes, and linked final check `b548e251-8887-48f7-a2e1-1c0a07b83049` exactly to Approval event `12c1f6eb-12eb-4568-a6e7-ab822b52c7a6`;
- both final records were attributed to preview admin `819bee46-dd38-427b-8f36-e99783f5788b`, the Approval event recorded `invoice_paid`, Approval completed successfully, and the request's `approval_status` became `approved`; and
- after validation, the Agreement remained locked and snapshot-exact, the Invoice remained paid at `$240` with zero balance, `multi_item_rental_requests` was restored to `false`, and `payment_policy` was restored to `unconfigured`.

These results extend rather than replace the earlier pre-Utah hosted baseline. Release 1 still uses trusted staff/admin uploads; direct customer uploads do not exist. Customer self-service uploads, customer notifications/status portal, and an “Accept for Processing” action remain deferred. This preview workflow evidence does not establish production application deployment, production browser behavior for the revised UI, production authorization, or Release 1 activation; the production schema migration is documented separately below.

### Unexpected automatic production schema application

Before `59acd8d`, production project `rental_requests` (`rzuzhdczpvxfsefzgtbv`) had migrations only through `20260805000100`. The Supabase GitHub integration was connected to `alexbritop24/urban-cowboy-rentals`, working directory `.`, production branch `main`, with “Deploy to production” enabled. Pushing `59acd8d` therefore automatically applied the pending Release 1 migrations through `20260809000100` to production before the intended controlled deployment step.

This was an unexpected automatic schema application, not an intentional controlled rollout. The production database gate remained `false`, so the schema application itself did not activate Release 1. The currently deployed production frontend was subsequently verified in legacy single-dropdown mode; the revised migration-dependent application artifact has not been deployed or production-browser-tested. No Release 1 activation was approved.

### Production preservation evidence

Immediate read-only production checks proved:

- all three legacy requests and all 17 historical Agreements remain;
- all 14 historical drafts on the duplicate-history request remain;
- all three ready/locked canonical historical Agreements remain;
- both issued/unpaid historical Invoices retain their IDs, request/Agreement links, numbers, `issued_at`, statuses, and financial values;
- Invoice 1 remains subtotal `$200.00`, deposit `$100.00`, delivery `$30.00`, tax `$10.00`, and total/balance `$340.00`;
- Invoice 2 remains subtotal `$100.00`, deposit `$49.95`, delivery/tax `$0.00`, and total/balance `$149.95`;
- no Agreement items, Invoice items, Payments, Documents, Approval events, or availability checks were fabricated for historical rows;
- historical Agreements remain snapshot-unverified without invented hashes or signatures;
- no orphan relationship or Agreement-cardinality conflict exists;
- Utility Trailer and RawMax catalog entries remain archived and non-rentable;
- reconciled foreign keys are validated `RESTRICT`;
- `multi_item_rental_requests = false`; and
- `payment_policy = unconfigured`.

No rollback was performed or recommended because the schema converged safely and production business data was preserved. Database preservation does not establish production UI route rendering, production authorization, an operational smoke test, or feature activation.

### Controlled production Utah migration application

Production project `rental_requests` (`rzuzhdczpvxfsefzgtbv`) passed a read-only preflight before migration `20260810000100_utah_driver_license_verification.sql` was applied. All three known production request markers were present, no preview request markers were present, the latest production migration was `20260809000100`, and `20260810000100` was absent. The backend `multi_item_rental_requests` gate was `false`, `payment_policy` was `unconfigured`, every required migration dependency existed, and every Utah wrapper precondition was clean or absent.

The production inventory before migration was three rental requests, 17 Agreements including three finalized Agreements, two issued/unpaid Invoices, zero Payments, zero Approval events, zero approved requests, zero document metadata rows, and zero current driver licenses. The following preservation baseline was captured before application:

| Business table | Rows | Preservation hash |
| --- | ---: | --- |
| `agreement_items` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `invoice_items` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `invoices` | 2 | `faf5d2a08694182b92ea9dbf9879137d` |
| `payments` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `rental_agreements` | 17 | `c22f8f8cbb4a12115202f5bf21df52bc` |
| `rental_approval_events` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `rental_availability_checks` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `rental_documents` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `rental_request_items` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `rental_requests` business fields | 3 | `7f59e438e66c161e151402ca5d9c39e7` |

The Invoice sequence baseline was `last_value = 1`, `is_called = false`; the Agreement sequence baseline was also `last_value = 1`, `is_called = false`.

The repository began linked to preview, was temporarily linked to production for the reviewed operation, and a production dry run showed that only migration `20260810000100` would be applied. The migration then applied successfully through the Supabase CLI with exit code `0`. The repository was immediately relinked to preview. No synthetic production data was created, no rollout gate was enabled, and the payment policy remained unchanged.

Post-migration verification proved that production now records `20260810000100` as its latest migration and that a subsequent production-linked dry run reported the remote database up to date. The repository link was again restored to preview. Every business-table row count and hash above matched exactly, and both sequence values and `is_called` states remained exact. All three existing requests initialized to `driver_license_verification_status = pending`; all driver-license evidence fields remained null; review history remained empty; and no acceptance, signature, verification, Approval, Payment, availability, or document evidence was fabricated.

Production still had 17 Agreements including three finalized Agreements, two issued/unpaid Invoices, zero Payments, zero Approval events, zero approved requests, and zero documents. Historical Invoice financial values and timestamps remained unchanged. The migration added six `rental_requests` columns, `rental_driver_license_reviews`, the review and capability RPCs, Utah assertion and wrapped prerequisite/checklist/Approval functions, seven validated constraints, four enabled triggers, review-history RLS, and the staff-only `SELECT` policy. New driver-license foreign keys use `RESTRICT`. Production configuration remained `multi_item_rental_requests = false` and `payment_policy = unconfigured`.

This was a controlled schema deployment and integrity verification only. It did not deploy the migration-dependent application, validate migration-dependent production authorization, run a production smoke test, or activate Release 1. No rollback is required or recommended.

### Vercel browser-gate baseline

The Vercel project serving `urbancowboyrentals.com` was manually inspected and contains no `VITE_ENABLE_MULTI_ITEM_RENTAL_REQUESTS` environment variable. Repository code enables the browser workflow only when the value is exact lowercase `true`, so future builds currently resolve the browser rollout gate to disabled/fail-closed. Do not add the variable during migration-dependent application deployment.

The currently deployed production site was already manually verified to retain the legacy single Equipment Requested dropdown. The migration-dependent application build has not been pushed or deployed, so post-deployment artifact and browser verification remain required after that application is pushed. This Vercel baseline does not establish application deployment or feature activation.

### Automatic-deployment safeguard

After the cause was identified, the operator disabled the Supabase GitHub integration’s “Deploy to production” toggle. The repository remains connected, but pushes to `main` no longer automatically apply production database migrations. Automatic preview branching is unavailable on the current Free plan. Future production database changes require an explicitly reviewed and manually confirmed procedure.

## Release Configuration Audit

Never include values in release evidence.

| Setting/variable | Repository state | Release classification |
| --- | --- | --- |
| `VITE_ENABLE_MULTI_ITEM_RENTAL_REQUESTS` | Absent from the Vercel project; repository behavior resolves missing/anything except exact lowercase `true` to false | Future builds remain fail-closed; the current deployed frontend is verified in legacy single-dropdown mode; do not add the variable yet |
| `private.release_feature_flags.multi_item_rental_requests` | Preview and production reverified as `false`, including after the controlled Utah migration | Backend rollout gate remains disabled in both environments |
| `RENTAL_DOCUMENT_MAX_BYTES` | Edge fallback and bucket constraint are 10,485,760 bytes | Preview passed; confirm production deployment configuration before activation |
| `RENTAL_DOCUMENT_SIGNED_URL_TTL_SECONDS` | Edge fallback 120 seconds, clamped to 60–300 | Preview passed; confirm production deployment configuration before activation |
| Approval `payment_policy` | Preview and production reverified as `unconfigured` | Client selected `invoice_paid`; set only during controlled activation |
| Preview migration version | `20260810000100` in retained project `cmqsvywbhswrycgxvbgy` | Hosted migration, rerun, dry run, authorization, race, lifecycle, and fresh walkthrough validation passed |
| Production migration version | `20260810000100` | Utah migration applied through the controlled CLI procedure; complete preservation and linked up-to-date dry-run checks passed; application deployment and activation remain pending |
| Supabase GitHub “Deploy to production” | Disabled after the automatic migration incident | Future production migrations require reviewed manual confirmation |
| `VITE_SUPABASE_URL` | Preview project identity passed harness confirmation | Preview passed; production configuration/activation remains pending |
| `VITE_SUPABASE_ANON_KEY` | Preview key worked without value disclosure | Preview passed; production value must remain unreported |
| Production `rental-documents` runtime | JWT enforcement, private bucket, 10 MB limit, PDF/JPEG/PNG allowlist, and Edge runtime checked without value disclosure | PASSED; retain staff-only signed-access boundaries |
| `SUPABASE_URL` | Preview and production Edge runtime checks completed without value disclosure | PASSED for current document runtime |
| `SUPABASE_ANON_KEY` | Preview and production Edge runtime checks completed without value disclosure | PASSED for current document runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | Remained server-side during preview and production runtime checks | PASSED for current document runtime; never expose value |
| Preview staff/admin `app_metadata` | Trusted claims and securely refreshed preview sessions validated under Node 22.23.1 | PASSED after reconciliation |
| Production admin `app_metadata` | Jason's admin role and refreshed session passed a read-only nonexistent-document lookup | PASSED for the limited authorization check |
| Production personal staff `app_metadata` | Staff role assigned | PENDING refreshed-session verification |
| `VITE_N8N_RENTAL_REQUEST_WEBHOOK` | Existing browser integration variable | CONFIGURED locally; operational endpoint test required |
| `VITE_N8N_AUTOMATION_WEBHOOK_URL` | Existing browser integration variable | CONFIGURED locally; operational endpoint test required |

## Client Decisions and Release Blockers

### P0 — cannot release

No P0 implementation defect is known from local or isolated hosted-preview validation. Any public document access, migration failure, authorization bypass, corrupt payment balance, or two successful conflicting Approvals discovered during later validation becomes P0 immediately.

### Completed in isolated hosted preview

- Sequential migration validation.
- Same-resource, reversed-order multi-resource, disjoint-resource, and payment-policy concurrency tests for the previously deployed preview schema.
- Forward reconciliation through `20260809000100`, complete before/after business-snapshot comparison, CLI up-to-date dry run, manual migration rerun, and second unchanged comparison.
- Forward application and safe reapplication of `20260810000100`, with pre/post identity, business-hash, sequence, schema, restrictive-FK, RLS, trigger, RPC, and append-only-history verification; the following linked dry run reported preview up to date.
- Post-reconciliation authorization with refreshed role-correct JWTs under Node 22.23.1.
- Utah-specific staff/admin authorization, customer/spoof denial, review-history RLS, exact-current-document enforcement, non-Utah rejection, and stale-document rejection under Node.js 22 without secret disclosure.
- Post-reconciliation independent-session same-request Agreement creation serialization: one success, one `23505` rejection, and one authoritative Agreement.
- Two-session driver-license replacement/review serialization, with review-before-replacement followed by authoritative pending-state reset and no stale evidence on the new document.
- Private Storage, document Edge Function, compensation cleanup, and signed URL validation.
- Trusted `app_metadata` authorization and ordinary/spoofed customer denial.
- Synthetic Agreement → Invoice → Payment → Approval workflow.
- Fresh Utah-inclusive Request `0dd094d6-258d-4be3-942f-87c783f97e04` through exact-current review, finalized Agreement, paid Invoice, final availability, and Approval with exact linked evidence.
- Locked-never-Approved rejection, Approved-state reversal requirement, post-reversal rejection, and fail-before-final-availability Approval behavior with transactional preservation.
- Approval reversal and reapproval.
- Inclusive-date parity and cancellation protection.

### Completed production containment and preservation checks

- Automatic schema application through `20260809000100` was identified and documented as an incident, not a controlled rollout.
- Read-only production checks preserved all known legacy IDs, links, statuses, timestamps, financial values, archived catalog state, and row counts without fabricated workflow evidence.
- The production backend rollout flag remains verified `false`, the deployed frontend was manually verified in legacy single-dropdown mode, and payment policy remains `unconfigured`.
- Supabase GitHub “Deploy to production” is disabled; future production migration changes require explicit review and manual confirmation.
- Jason's refreshed production admin session passed a read-only nonexistent-document authorization lookup; no customer document or PII was read.
- The private `rental-documents` bucket, 10 MB limit, PDF/JPEG/PNG allowlist, JWT enforcement, signed-access runtime, and Edge runtime passed production verification.
- Controlled application of `20260810000100` completed with an exit-code-`0` CLI apply, exact business-table and sequence preservation, clean pending initialization, no fabricated evidence, and a following production-linked up-to-date dry run.
- The repository link was restored to retained preview project `cmqsvywbhswrycgxvbgy`; production remained at backend gate `false` and payment policy `unconfigured`.
- The Vercel project has no browser-gate variable, so future builds remain fail-closed; no migration-dependent application build has been deployed.

### P1 — resolve before production activation

- Deploy the migration-dependent application code now that production migration `20260810000100` is integrity-verified, keeping both rollout gates disabled; then verify the deployed artifact and browser remain fail-closed before any activation step.
- Verify the personal staff account's refreshed production session; Jason's admin session has passed.
- Keep the selected `invoice_paid` policy recorded but leave the database `unconfigured` until the controlled activation step.
- Client/counsel approves final Agreement, card-authorization, signature, and Business-signing wording.
- Client defines insurance coverage, effective/expiration rules, and verifier authority.
- Client approves identity/insurance retention and deletion procedures.
- Client confirms the operational Agreement/Invoice delivery and signature channel.
- Confirm the webhook endpoints and operational owners used during activation.
- Explicitly accept the partial hosted legacy evidence described above.
- Perform only an explicitly approved, non-destructive production smoke test.
- Approve the backend and browser gate enablement sequence; neither may be enabled until that approval.
- Complete final production activation approval and assign the monitoring window and operator.
- Retain the preview validation database until this readiness documentation and remaining production verification are complete.

These are production-activation blockers, not reasons to redesign the implemented architecture.

### P2 — safe post-launch hardening

- Persist orphan-document cleanup failures in a durable queue/metric rather than relying only on the Edge Function error.
- Replace raw uploader UUID presentation with an approved staff display identity if still visible operationally.
- Upgrade the local/CI Node runtime from 20.17 to a Vite/Supabase-supported Node 22 release; current builds pass with warnings.
- Add a durable observability platform beyond the minimum signals below.
- Canonical immutable PDF storage remains explicitly deferred.
- Customer self-service document uploads, customer notifications/status portal, and an “Accept for Processing” action remain deferred beyond Release 1.

## Production Activation Order

Controlled preparatory and verification steps 1–9 may proceed with the approval required for each task. Steps 2–3 are complete. Do not begin step 10, the separately controlled payment-policy configuration, or step 11, the first rollout-gate activation step, until every P1 blocker and owner sign-off is complete.

1. Review and accept this incident, reconciliation, and production-preservation record; tag no release yet.
2. **Complete:** Automatic production deployment is disabled, retained preview project `cmqsvywbhswrycgxvbgy` records validated migration `20260810000100`, and deployed production history will not be rolled back or rewritten.
3. **Complete:** Migration `20260810000100_utah_driver_license_verification.sql` was applied to production through the reviewed manual forward-only procedure and integrity-verified without fabricating evidence; the repository link was restored to preview.
4. **Next pending preparatory step:** Deploy the migration-dependent application code with `private.release_feature_flags.multi_item_rental_requests = false` and `VITE_ENABLE_MULTI_ITEM_RENTAL_REQUESTS` absent/disabled. This order remains mandatory because the application unconditionally queries the new driver-license fields, `rental_driver_license_reviews` history table, `get_rental_document_workflow_capabilities()` RPC, and `review_rental_driver_license()` RPC. Do not add the Vercel browser-gate variable yet.
5. Verify the personal staff account's refreshed production session; retain Jason's passed admin evidence.
6. Resolve and record all legal, insurance, retention, delivery/signature, webhook-owner, and partial legacy-route evidence decisions.
7. Reconfirm the passed production document/Storage runtime controls and verify the production webhook endpoints.
8. Verify the newly deployed production artifact has no enabled browser gate and confirm the production frontend remains in legacy single-dropdown mode with both rollout gates disabled.
9. Run only the approved non-destructive production smoke test with synthetic/minimal data, including the agreed route/PDF and operational checks. Keep the production payment policy `unconfigured` during these preparatory checks.
10. Through separately approved and controlled database administration, set the selected `invoice_paid` policy; until this step begins successfully, the production payment policy must remain `unconfigured`.
11. **First rollout-gate activation step:** enable the database `multi_item_rental_requests` gate.
12. Verify server RPCs, legacy behavior, and monitoring before exposing the browser path.
13. Deploy/configure `VITE_ENABLE_MULTI_ITEM_RENTAL_REQUESTS=true` and verify the built artifact.
14. Complete the approved operational request → Approval smoke test.
15. Monitor the signals below through the agreed observation window.
16. After final production activation sign-off, tag the reviewed `main` commit as `v1.0.0`.

Migration `20260810000100` has passed in retained preview and has now been deliberately applied and integrity-verified in production. Its dependent application code has not been pushed or deployed. That application deployment must leave the backend gate `false` and the Vercel browser variable absent/disabled; backend activation later precedes browser activation so a stale or early browser cannot make the server accept unfinished writes. The currently deployed frontend retains the legacy single-dropdown path; verify the post-deployment artifact and browser state during step 8 before any gate activation.

Do not activate production until every remaining business, legal, security, and operations sign-off is complete. Activation and any rollback action must preserve immutable Agreements, Invoices, Payments, Documents, availability checks, and Approval events.

## Rollback Strategy

Do not reverse or destructively edit migrations. If activation reveals a defect:

1. disable the browser flag in the deployed frontend;
2. set the backend rollout flag to false;
3. stop new Release 1 multi-item creation while retaining legacy booking;
4. preserve every created request, document, finalized Agreement, issued Invoice, Payment, availability check, and Approval/reversal event;
5. deploy a reviewed forward fix/migration; and
6. repeat hosted regression and smoke tests before reactivation.

Finalized Agreement snapshots, issued Invoice snapshots, Payments, document history, and Approval evidence are intentionally immutable and cannot be safely “rolled back.” Operational reversal/cancellation must use their audited workflows.

## Minimum Monitoring After Activation

| Signal | Existing source |
| --- | --- |
| Request/RPC rejection | Application error handling and Supabase function/database logs |
| Agreement finalization/acceptance failure | RPC errors and Agreement UI notices |
| Document upload/registration/cleanup failure | Edge Function logs; cleanup failure is currently not durable |
| Driver-license review rejection/stale-document failure | Review RPC errors, current request state, and append-only review history |
| Insurance review failure | RPC errors and request review state |
| Invoice creation/issuance failure | RPC errors and Invoice state |
| Payment rejection/balance mismatch | Payment RPC errors, Payments, and Invoice balances |
| Approval denial by gate | Checklist state/reason and RPC result |
| Final availability conflict | `rental_availability_checks` final conflict rows |
| Approval/reversal volume | Append-only `rental_approval_events` |

Assign an operator and alert/check cadence before activation. Do not log document contents, signed URLs, card data, credentials, or customer PII.

## Post-Activation Smoke Test

- Public legacy booking still creates a neutral pending request.
- Multi-item browser request creates authoritative normalized items and compatible scalar summary.
- Archived equipment is absent from new selection and still visible historically.
- Staff/admin route access works; ordinary authenticated and spoofed users remain denied.
- Agreement/Invoice routes and PDFs render all immutable items/totals.
- Private staff document upload/view works without public URLs; customer self-service upload remains deferred to Release 1.1.
- Manual driver-license review targets the exact current document, verifies only `UT`, and observes finalized/Approved lifecycle capabilities.
- Insurance review remains independent and is disabled after Agreement finalization.
- Invoice issue and a controlled Payment preserve exact balance.
- Checklist reasons are actionable; final availability is rechecked.
- One rental can be Approved, reversed, and reapproved with append-only evidence.
- Existing `/admin/agreement/:id` and `/invoice/:id` identifiers/routes remain valid.

## Validation Record

Local validation completed on 2026-08-08:

```text
npm run lint
npm run test:persistence
npm run test:agreement
npm run test:documents
npm run test:approval
npm run check:domain
npm run test:hosted -- --help
feature-disabled production build
feature-enabled production build
git diff --check
```

Results:

- `npm run lint` — passed.
- `npm run test:persistence` — 30/30 passed, including clean/sequential/rerun migration, grants/RLS, fixed `search_path`, managed-schema, pgcrypto, Agreement, Invoice, Payment, Document, Approval, and legacy coverage.
- `npm run test:agreement` — 8/8 passed.
- `npm run test:documents` — 4/4 passed.
- `npm run test:approval` — 6/6 passed.
- `npm run check:domain` — 45 domain files, zero circular dependencies.
- Hosted harness syntax/help and preview mutation refusal — passed locally without contacting hosted infrastructure.
- Feature-disabled and feature-enabled production builds — passed. Node 20.17 emitted the documented Vite/Supabase runtime warning.
- `git diff --check` and the migration qualification/managed-schema audit — passed.

Final local regression rerun completed on 2026-08-13:

```text
npm run lint
npm run test:persistence
npm run check:domain
feature-disabled production build
feature-enabled production build
git diff --check
```

Results:

- `npm run lint` — passed.
- `npm run test:persistence` — 30/30 passed.
- `npm run check:domain` — 45 domain files, zero circular dependencies.
- Feature-disabled and feature-enabled production builds — passed.
- `git diff --check` — passed; the repository was clean before this readiness-record update.
- Node 20.17 again emitted the documented Vite minimum-version warning; the builds completed successfully.

Production-shape compatibility remediation was validated locally on 2026-08-14:

```text
node --test tests/persistence/production-compatibility.test.mjs
npm run lint
npm run test:persistence
npm run check:domain
feature-disabled production build
feature-enabled production build
git diff --check
```

Results:

- Production compatibility tests — 3/3 passed, covering the production-shaped legacy fixture, deterministic canonical Agreement selection and duplicate-attempt rejection under embedded PGlite execution, and forward reconciliation from a faithfully reconstructed old-preview state.
- Behavioral repository lookup test — passed for canonical ranking, deterministic draft fallback/tie-breaking, empty results, and direct Agreement-ID lookup.
- `npm run lint` — passed.
- `npm run test:persistence` — 34/34 passed.
- `npm run check:domain` — 45 domain files, zero circular dependencies.
- Feature-disabled and feature-enabled production builds — passed.
- `git diff --check` — passed.
- Node 20.17 emitted the existing Vite minimum-version warning; both production builds completed successfully.
- These local commands used no hosted target. Subsequent preview reconciliation and the automatic production schema incident are recorded separately below.

Hosted reconciliation and production preservation follow-up completed after `59acd8d` was pushed:

- Preview preflight identified only `20260809000100` as pending; application succeeded and the following dry run reported the remote database up to date.
- All ten preview business-table hashes/counts matched before and immediately after reconciliation; indexes, canonical functions, five validated `RESTRICT` foreign keys, sequences at `8`, disabled backend flag, and `unconfigured` payment policy were correct.
- Manual reapplication completed successfully with no returned rows, and the second comparison remained unchanged. Hosted idempotency passed.
- After switching from unsupported Node 20 behavior to Node 22.23.1 and securely refreshing expired JWTs, post-reconciliation hosted authorization passed for the expected staff/admin/customer/spoofed-customer boundaries.
- Two independent staff JWT sessions raced Agreement creation for preview request `e9b3d4a1-22c7-4ee5-bf51-202608150001`: one succeeded, one returned `23505`, and exactly one Agreement/item snapshot was created.
- The whole-database idempotency comparison preceded that intentional fixture and is not claimed after its creation.
- The production GitHub integration automatically applied migrations through `20260809000100` when `59acd8d` reached `main`; this was not an intentional controlled production rollout.
- Immediate production inspection preserved all known historical records, identifiers, links, timestamps, statuses, exact Invoice financials, archived catalog state, and snapshot-unverified legacy classification without fabricating workflow evidence.
- Production remained inactive with the backend rollout flag verified `false` and payment policy `unconfigured`; the deployed production frontend was subsequently verified in legacy single-dropdown mode. No rollback was performed or recommended.
- The GitHub integration’s automatic production deployment toggle was disabled after the incident.

Earlier hosted validation was completed in the isolated `urban-cowboy-rentals-r1-validation` preview during 2026-08-11 through 2026-08-13. Sanitized results:

- Hosted preview confirmation and sequential migration validation — passed.
- Trusted `app_metadata` staff/admin authorization, ordinary customer denial, and spoofed-metadata denial — passed.
- Private Storage, Edge Function upload/registration, signed URL behavior, and compensation cleanup — passed.
- Unconfigured payment-policy fail-closed behavior — passed.
- Automated same-resource, reversed-order multi-resource, and disjoint-resource Approval races — passed.
- Direct same-resource serialization — passed; the waiter blocked and then returned `availability_conflict`.
- Direct X+Y/Y+X sorted-lock serialization — passed without deadlock; the waiter returned `availability_conflict` after the holder committed.
- Direct disjoint-resource concurrency — passed; the second Approval completed while the first transaction remained open.
- Payment-policy row serialization — passed; the Approved event retained the policy evaluated in its transaction.
- Synthetic request through Agreement, acceptance/card authorization, private documents, insurance verification, Invoice, exact Payment, Approval, reversal, and reapproval — passed.
- Inclusive-date parity — passed across the legacy RPC, initial/final checks, and browser advisory: August 10–12 conflicts with August 12–14 and permits August 13–14.
- Cancellation protection — passed: direct cancellation while Approved failed; audited reversal released the resource; cancellation then succeeded without rewriting history.
- Preview cleanup — passed: `payment_policy = unconfigured` and `multi_item_rental_requests = false` were reverified.
- Hosted legacy evidence — partial. The only request without normalized items, `61d9c74e-7b1a-4464-ad2b-c4f06f38a9cd`, was the obsolete synthetic document-validation fixture described above. It had no Agreement, Invoice, Payment, availability history, or Approval history, and it remains as retained preview evidence. The preview contained zero representative historical legacy Agreements and zero representative historical legacy Invoices, so historical route rendering and `legacy_unverified` presentation were not testable and are not claimed as hosted passes. Local automated compatibility coverage remains green; no rows were fabricated, backfilled, or mutated.

Utah driver-license verification was implemented and validated locally on 2026-08-15 before hosted validation. The focused and full local regression evidence was:

- forward-only migration `20260810000100` preserves existing production-shaped rows as `pending`, creates no review events, and reruns safely;
- focused authorization, exact-inspected-document binding, replacement-race rejection, append-only history/RLS, Agreement/Approval gates, server-derived UI capabilities, stale-evidence defense, locked-never-Approved rejection, and audited reversal correction tests — 4/4 passed;
- existing document tests — 4/4 passed; existing Approval tests — 6/6 passed;
- full persistence suite — 38/38 passed;
- `npm run lint` and 45-file domain-cycle analysis — passed with zero cycles; and
- feature-disabled and feature-enabled production builds — passed under Node 22.23.1.

During the hosted workflow-validation phase, migration `20260810000100` was applied to retained preview project `cmqsvywbhswrycgxvbgy`. Preflight under Node.js 22, secure token refresh, the Utah authorization/RLS matrix, exact-document and non-Utah rejection behavior, review-history visibility, replacement reset, the two-session replacement/review race, finalized/Approved lifecycle rules, transactional Approval failure, migration reapplication, linked up-to-date dry run, and the fresh Utah-inclusive workflow all passed. No secrets were printed. Preview cleanup reverified `multi_item_rental_requests = false` and `payment_policy = unconfigured`.

The Utah workflow evidence above was produced in preview, not production. In a later separately controlled production operation, migration `20260810000100` applied successfully with exit code `0`; exact pre/post business-table hashes, counts, and sequence state matched; all three existing requests initialized pending with null evidence; no review history or other workflow evidence was fabricated; and a subsequent production-linked dry run reported the remote database up to date. The repository link was restored to preview. Production rollout gates remain disabled and payment policy remains `unconfigured`. Dependent application deployment, revised production artifact/browser validation, migration-dependent production authorization, smoke testing, and release sign-offs remain pending.

## Sign-off

| Area | Owner | Status/date |
| --- | --- | --- |
| Engineering/local validation | Commit `59acd8d` | Passed and pushed to `main` |
| Local production-shape migration compatibility | Commit `59acd8d` | Passed 2026-08-14 |
| Prior isolated preview migration/concurrency | Validation operator | Passed 2026-08-13 before the production-shape reconciliation |
| Isolated preview reconciliation/idempotency | Validation operator | Passed; apply, dry run, manual rerun, and comparisons complete |
| Post-reconciliation Agreement creation race | Validation operator | Passed with two independent staff JWT sessions |
| Isolated preview security/Storage authorization | Validation operator | Passed 2026-08-13 |
| Post-reconciliation preview authorization | Validation operator | Passed under Node 22.23.1 with securely refreshed sessions; Utah staff/admin allow and customer/spoof deny boundaries also passed after `20260810000100` |
| Preview Utah migration/idempotency | Validation operator | Passed in retained project `cmqsvywbhswrycgxvbgy`; pre/post preservation, safe rerun, and linked up-to-date dry run complete |
| Preview Utah replacement/review race | Validation operator | Passed with two sessions; review serialized before replacement and replacement authoritatively reset the new current document to pending |
| Preview Utah-inclusive workflow | Validation operator | Passed through exact-current review, locked Agreement `UCR-2026-000010`, paid Invoice `INV-2026-000009`, final availability, and Approval; gates/policy restored |
| Hosted legacy routes | Validation operator | Not testable — zero representative historical Agreement/Invoice records; evidence partial |
| Production schema migrations | Release operator | Automatic application through `20260809000100` and controlled application of `20260810000100` are integrity-verified; not application deployment or activation |
| Automatic production deployment safeguard | Release operator | “Deploy to production” disabled after incident |
| Production admin authorization | Release operator | Jason's role and refreshed session passed the read-only nonexistent-document lookup |
| Production personal staff authorization | Release operator | Role assigned; refreshed session pending verification |
| Production document/Storage deployment | Release operator | Passed JWT, private-bucket, 10 MB, PDF/JPEG/PNG, signed-access, and Edge runtime verification |
| Production frontend rollout baseline | Release operator | Manually verified with one legacy Equipment Requested dropdown |
| Vercel browser rollout gate | Release operator | Variable absent; repository exact-`true` behavior makes future builds fail-closed; post-application-deployment artifact/browser verification pending |
| Migration-dependent production application | Release operator | Not pushed or deployed; deploy next with both rollout gates disabled |
| Utah driver-license verification | Engineering/release operator | Local and hosted-preview workflow validation passed; production migration is deployed and integrity-verified; production application, authorization, and smoke test pending |
| Approved production smoke test | Release operator | Pending |
| Payment policy activation | Client/release operator | `invoice_paid` selected; database remains `unconfigured` pending controlled activation |
| Legal Agreement wording |  | Pending |
| Insurance/retention/delivery operations |  | Pending |
| Production activation approval |  | Pending |
