# Urban Cowboy Rentals — Release 1 Readiness and Activation Runbook

## Current Release Status

Release 1 is **engineering-validated in local and isolated hosted-preview environments, but not approved for production activation**. The implemented chain is:

`Rental Request → normalized items → initial availability → Agreement → acceptance/card authorization → private documents → insurance verification → Invoice → Payment → final availability → Approval → reversal/reapproval`

The remaining work is client configuration/sign-off, the documented partial hosted-legacy limitation, and controlled production activation. Neither rollout gate is enabled by this readiness sprint, and the Approval payment policy remains `unconfigured`.

Detailed behavior remains defined in the [Release 1 specification](urban-cowboy-rentals-release-1-spec.md), [ERD](urban-cowboy-rentals-release-1-erd.md), [security/role contract](urban-cowboy-rentals-release-1-security-roles.md), and [Approval workflow](urban-cowboy-rentals-release-1-approval-workflow.md).

## Readiness Matrix

| Capability | Status | Evidence or remaining proof |
| --- | --- | --- |
| Multi-item request persistence | HOSTED VALIDATED | Transactional RPC, authoritative catalog, lifecycle guards, hosted synthetic workflow, and local migration tests pass; backend gate remains off. |
| Agreement creation/finalization | HOSTED VALIDATED | Hosted creation, acceptance, document/insurance gates, finalization, and immutable snapshot verification pass. |
| Agreement snapshots | READY | Clause and complete-material SHA-256 hashes are persisted and locally verified. |
| Agreement PDF | READY | Uses persisted snapshot data; legacy unverifiable records fail closed. Browser PDF is intentionally interim. |
| Document upload | HOSTED VALIDATED | Hosted Edge Function uploads, type/signature validation, randomized paths, registration, and compensation cleanup pass. |
| Private Storage | HOSTED VALIDATED | Hosted bucket is private with the expected limits and authorization boundaries. |
| Signed document URLs | HOSTED VALIDATED | Hosted short-lived signed URL access and expiry behavior pass. |
| Insurance verification | HOSTED VALIDATED | Hosted review binds the exact current insurance document. |
| Invoice creation | HOSTED VALIDATED | Hosted Agreement-derived, idempotent original Invoice creation and snapshot lineage pass. |
| Invoice issuance | HOSTED VALIDATED | Hosted issuance locks the snapshot and preserves totals. |
| Payment | HOSTED VALIDATED | Hosted append-only payment recording produced the exact paid balance with no drift. |
| Approval checklist | HOSTED VALIDATED | Hosted server-derived gates, actionable reasons, and fail-closed policy behavior pass. |
| Initial availability | HOSTED VALIDATED | Hosted hash-bound inclusive-date checks pass. |
| Final availability | HOSTED VALIDATED | Hosted Approval races and direct sessions prove final recheck after deterministic resource locking. |
| Approval | HOSTED VALIDATED | Same-resource, reversed-order multi-resource, disjoint-resource, and payment-policy serialization pass. |
| Approval reversal | HOSTED VALIDATED | Hosted append-only reversal, cancellation protection, and resource release pass. |
| Reapproval | HOSTED VALIDATED | Hosted reversal/reapproval re-ran every gate and created new final evidence. |
| Legacy compatibility | READY — HOSTED EVIDENCE PARTIAL | Local request/Agreement/Invoice/route coverage passes. The preview's only request without normalized items was an obsolete synthetic document-validation fixture, and it contained zero representative historical Agreements or Invoices. Hosted legacy route rendering and `legacy_unverified` presentation were therefore not testable; no fixtures were fabricated or backfilled. |
| Authorization/RLS | HOSTED VALIDATED | Hosted trusted `app_metadata` staff/admin, ordinary customer denial, spoofed-user denial, RPC boundaries, and Storage policies pass. |
| Production rollout gates | READY | Browser default is disabled; database default is `false`. Activation is intentionally separate. |

No current item is classified `BLOCKED — ENGINEERING`. Production activation remains blocked by the business decisions below and requires explicit acceptance of the partial hosted-legacy evidence.

## Hosted Validation Harness

The repository provides `npm run test:hosted -- <command>`. It uses the existing Supabase client and adds no testing framework. It never prints credential values or customer data.

The harness refuses every hosted target unless:

- `RELEASE_VALIDATION_ENVIRONMENT=preview`;
- `RELEASE_VALIDATION_CONFIRM_PROJECT_REF` exactly matches the project reference parsed from `VITE_SUPABASE_URL`; and
- mutating commands also set `RELEASE_VALIDATION_ALLOW_MUTATIONS=YES_I_UNDERSTAND_PREVIEW_ONLY`.

Do not set these confirmations for production. Use an isolated hosted preview reset from the Release 1 migrations. Synthetic records created by the test remain auditable and should be discarded by resetting/deleting the preview project, not by bypassing application retention guards.

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
| Insurance review | Deny | Deny | Allow | Allow | Staff RPC |
| Agreement finalization | Deny | Deny | Allow when gates pass | Allow when gates pass | Staff RPC |
| Invoice create/issue | Deny | Deny | Allow | Allow | Staff RPC |
| Payment recording | Deny | Deny | Allow | Allow | Staff RPC |
| Initial availability | Deny | Deny | Allow | Allow | Staff RPC |
| Approval | Deny | Deny | Allow when every gate passes | Allow when every gate passes | Staff RPC |
| Reversal | Deny | Deny | Allow for Approved rental | Allow for Approved rental | Staff RPC |

Only `app_metadata.role` or `app_metadata.app_role` values `staff`/`admin` are trusted. A customer-controlled `user_metadata` value never grants authority.

## Synthetic End-to-End Walkthrough

This walkthrough passed in the isolated hosted preview. Retain the procedure for a future preview rerun or approved production smoke test, and run it only after clean hosted migration and authorization validation. Use two active, different serialized catalog items and synthetic customer data.

1. Enable the backend gate temporarily in the isolated preview—not production—and create a multi-item request through `create_rental_request_with_items()`.
2. Confirm normalized child rows, independent dates/rates, quantity `1`, authoritative names/serials/rates, and legacy scalar summary.
3. Confirm initial availability.
4. Create the Agreement and verify its item/clause/material snapshots and `sha256:` hashes.
5. Record typed-name acceptance and credit-card authorization acknowledgment; never submit card number or CVV.
6. Run the document harness or upload generated license/insurance files, then verify the current insurance document.
7. Finalize the Agreement and confirm immutable status/hash evidence.
8. Create exactly one original Invoice, issue it, and verify snapshot lineage.
9. Record a valid synthetic Payment only when required by the isolated-preview policy.
10. Inspect the checklist. With `unconfigured`, stop and record the correct fail-closed result.
11. In a separate isolated-policy test, approve, verify the Approved event/final availability evidence, reverse, confirm every dependent record remains, and reapprove after all gates pass again.
12. Restore the payment policy and backend gate to disabled defaults and reset the isolated preview when evidence is retained elsewhere.

The browser gate remains off throughout backend walkthroughs. It is not necessary to expose unfinished behavior to test trusted RPCs.

## Inclusive Dates, Cancellation, and Legacy Walkthroughs

Inclusive-date hosted validation passed with one serialized unit for August 10–12, a conflicting August 12–14 request, and an available August 13–14 request. The public legacy RPC, initial confirmation, final Approval, and browser advisory agreed.

Cancellation protection also passed: directly setting an Approved request to `cancelled` failed. After `reverse_rental_approval()`, operational cancellation succeeded and the reversed rental no longer blocked solely because of its former Approval. Approved and Reversed events remained append-only.

The preview's only request without `rental_request_items` was `61d9c74e-7b1a-4464-ad2b-c4f06f38a9cd`. Inspection proved that it is an obsolete synthetic document-validation fixture, not representative business history:

- `full_name` is `Synthetic Release Validation`;
- its generated email identifies an `r1-doc` test, and its phone is a placeholder;
- `equipment_requested` explicitly identifies a synthetic document fixture;
- it has no rental dates, normalized items, Agreement, Invoice, Payment, availability history, or Approval history; and
- it has two tiny synthetic document files with matching private Storage objects.

This fixture does not reveal a Release 1 defect and must not be backfilled. It remains in the temporary preview only as retained validation evidence until that preview project is deleted.

The hosted preview contained zero representative historical legacy Agreements and zero representative historical legacy Invoices. Hosted rendering of `/admin/agreement/:id` and `/invoice/:id`, including `legacy_unverified` presentation, was therefore **not testable** and is not claimed as a hosted pass. Local automated legacy compatibility coverage passes. Before activation, perform a read-only inventory of actual production legacy records; do not backfill, mutate, or fabricate records merely to expand validation evidence.

## Release Configuration Audit

Never include values in release evidence.

| Setting/variable | Repository state | Release classification |
| --- | --- | --- |
| `VITE_ENABLE_MULTI_ITEM_RENTAL_REQUESTS` | Missing/anything except exact `true` resolves to false | Browser rollout gate remains disabled |
| `private.release_feature_flags.multi_item_rental_requests` | Migration default `false`; restored and reverified after preview testing | Backend rollout gate remains `false` |
| `RENTAL_DOCUMENT_MAX_BYTES` | Edge fallback and bucket constraint are 10,485,760 bytes | Preview passed; confirm production deployment configuration before activation |
| `RENTAL_DOCUMENT_SIGNED_URL_TTL_SECONDS` | Edge fallback 120 seconds, clamped to 60–300 | Preview passed; confirm production deployment configuration before activation |
| Approval `payment_policy` | Migration default `unconfigured`; restored and reverified after preview testing | Remains `unconfigured`; client decision required before activation |
| `VITE_SUPABASE_URL` | Preview project identity passed harness confirmation | Preview passed; production configuration/activation remains pending |
| `VITE_SUPABASE_ANON_KEY` | Preview key worked without value disclosure | Preview passed; production value must remain unreported |
| `SUPABASE_URL` | Preview Edge runtime configured successfully | Preview passed; production deployment/configuration remains pending |
| `SUPABASE_ANON_KEY` | Preview Edge runtime configured successfully | Preview passed; production deployment/configuration remains pending |
| `SUPABASE_SERVICE_ROLE_KEY` | Preview secret remained server-side and passed required document operations | Preview passed; production secret/configuration remains pending |
| Preview staff/admin `app_metadata` | Trusted claims and refreshed preview sessions were validated | PASSED 2026-08-13 |
| Production staff/admin `app_metadata` | Account- and session-specific | PENDING production audit and session refresh |
| `VITE_N8N_RENTAL_REQUEST_WEBHOOK` | Existing browser integration variable | CONFIGURED locally; operational endpoint test required |
| `VITE_N8N_AUTOMATION_WEBHOOK_URL` | Existing browser integration variable | CONFIGURED locally; operational endpoint test required |

## Client Decisions and Release Blockers

### P0 — cannot release

No P0 implementation defect is known from local or isolated hosted-preview validation. Any public document access, migration failure, authorization bypass, corrupt payment balance, or two successful conflicting Approvals discovered during later validation becomes P0 immediately.

### Completed in isolated hosted preview

- Sequential migration validation.
- Same-resource, reversed-order multi-resource, disjoint-resource, and payment-policy concurrency tests.
- Private Storage, document Edge Function, compensation cleanup, and signed URL validation.
- Trusted `app_metadata` authorization and ordinary/spoofed customer denial.
- Synthetic Agreement → Invoice → Payment → Approval workflow.
- Approval reversal and reapproval.
- Inclusive-date parity and cancellation protection.

### P1 — resolve before production activation

- Apply the preview-validated migrations to production through the controlled forward-only migration procedure.
- Verify production staff/admin `app_metadata` and refreshed sessions.
- Client selects `deposit_required` or `invoice_paid`; if deposit-based, define zero-deposit behavior.
- Client/counsel approves final Agreement, card-authorization, signature, and Business-signing wording.
- Client defines insurance coverage, effective/expiration rules, and verifier authority.
- Client approves identity/insurance retention and deletion procedures.
- Client confirms the operational Agreement/Invoice delivery and signature channel.
- Confirm the webhook endpoints and operational owners used during activation.
- Explicitly accept the partial hosted legacy evidence described above.
- Complete a read-only inventory of actual production legacy records before activation, without backfill or mutation.

These are production-activation blockers, not reasons to redesign the implemented architecture.

### P2 — safe post-launch hardening

- Persist orphan-document cleanup failures in a durable queue/metric rather than relying only on the Edge Function error.
- Replace raw uploader UUID presentation with an approved staff display identity if still visible operationally.
- Upgrade the local/CI Node runtime from 20.17 to a Vite/Supabase-supported Node 22 release; current builds pass with warnings.
- Add a durable observability platform beyond the minimum signals below.
- Canonical immutable PDF storage remains explicitly deferred.

## Production Activation Order

Do not execute this sequence until every P1 owner signs off.

1. Merge all reviewed Release 1 code to `main`; tag no release yet.
2. Apply the already preview-validated forward migrations to production through a controlled migration plan; do not perform destructive rollback or rewrite deployed migration history.
3. Deploy/configure `rental-documents`; verify JWT enforcement and private bucket configuration.
4. Assign and verify trusted staff/admin `app_metadata`; refresh sessions.
5. Resolve and record all client/legal/insurance/retention/delivery decisions, explicitly accept the partial hosted legacy evidence, and complete the read-only production legacy inventory.
6. Set the chosen production payment policy through controlled database administration.
7. Run a non-destructive production configuration smoke test with synthetic/minimal data only where approved.
8. Enable the database `multi_item_rental_requests` gate.
9. Verify server RPCs, legacy behavior, and monitoring before exposing the browser path.
10. Deploy/configure `VITE_ENABLE_MULTI_ITEM_RENTAL_REQUESTS=true` and verify the built artifact.
11. Complete an operational request → Approval smoke test and route/PDF checks.
12. Monitor the signals below through the agreed observation window.
13. After sign-off, tag the reviewed `main` commit as `v1.0.0`.

Backend activation precedes browser activation so a stale/early browser cannot make the server accept unfinished writes. Readiness validation itself leaves both gates off.

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
- Private document upload/view/insurance review works without public URLs.
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

Hosted validation was completed in the isolated `urban-cowboy-rentals-r1-validation` preview during 2026-08-11 through 2026-08-13. Sanitized results:

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
- Hosted legacy evidence — partial. The only request without normalized items, `61d9c74e-7b1a-4464-ad2b-c4f06f38a9cd`, was the obsolete synthetic document-validation fixture described above. It had no Agreement, Invoice, Payment, availability history, or Approval history, and it remains only as retained preview evidence until preview deletion. The preview contained zero representative historical legacy Agreements and zero representative historical legacy Invoices, so historical route rendering and `legacy_unverified` presentation were not testable and are not claimed as hosted passes. Local automated compatibility coverage remains green; no rows were fabricated, backfilled, or mutated.

## Sign-off

| Area | Owner | Status/date |
| --- | --- | --- |
| Engineering/local validation | Readiness branch | Passed 2026-08-13 |
| Isolated preview migration/concurrency | Validation operator | Passed 2026-08-13 |
| Isolated preview security/Storage authorization | Validation operator | Passed 2026-08-13 |
| Isolated preview staff/admin authorization | Validation operator | Passed 2026-08-13 |
| Hosted legacy routes | Validation operator | Not testable — zero representative historical Agreement/Invoice records; evidence partial |
| Production migrations | Release operator | Pending controlled application |
| Production staff/admin authorization | Release operator | Pending `app_metadata` audit and refreshed-session verification |
| Client operations/payment policy |  | Pending |
| Legal Agreement wording |  | Pending |
| Insurance/retention/delivery operations |  | Pending |
| Production activation approval |  | Pending |
