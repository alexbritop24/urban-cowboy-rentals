# Urban Cowboy Rentals — Release 1 Readiness and Activation Runbook

## Current Release Status

Release 1 is **locally validated but not approved for production activation**. The implemented chain is:

`Rental Request → normalized items → initial availability → Agreement → acceptance/card authorization → private documents → insurance verification → Invoice → Payment → final availability → Approval → reversal/reapproval`

The remaining work is hosted-environment proof and client configuration/sign-off. Neither rollout gate is enabled by this readiness sprint, and the Approval payment policy remains `unconfigured`.

Detailed behavior remains defined in the [Release 1 specification](urban-cowboy-rentals-release-1-spec.md), [ERD](urban-cowboy-rentals-release-1-erd.md), [security/role contract](urban-cowboy-rentals-release-1-security-roles.md), and [Approval workflow](urban-cowboy-rentals-release-1-approval-workflow.md).

## Readiness Matrix

| Capability | Status | Evidence or remaining proof |
| --- | --- | --- |
| Multi-item request persistence | READY — HOSTED VALIDATION REQUIRED | Transactional RPC, authoritative catalog, lifecycle guards, and local migration tests pass; backend gate remains off. |
| Agreement creation/finalization | READY — HOSTED VALIDATION REQUIRED | Idempotent creation, legal/document gates, immutable snapshots, and local tests pass. |
| Agreement snapshots | READY | Clause and complete-material SHA-256 hashes are persisted and locally verified. |
| Agreement PDF | READY | Uses persisted snapshot data; legacy unverifiable records fail closed. Browser PDF is intentionally interim. |
| Document upload | READY — HOSTED VALIDATION REQUIRED | Edge Function and validators exist; actual hosted Storage/Function execution remains required. |
| Private Storage | READY — HOSTED VALIDATION REQUIRED | Migration specifies a private 10 MB PDF/JPEG/PNG bucket and staff-only policy. Hosted state must be inspected. |
| Signed document URLs | READY — HOSTED VALIDATION REQUIRED | Edge Function issues 60–300 second URLs (120-second default); hosted expiry/access must be proven. |
| Insurance verification | READY — HOSTED VALIDATION REQUIRED | Review binds the current insurance document and replacement invalidates review. |
| Invoice creation | READY — HOSTED VALIDATION REQUIRED | Agreement-derived, idempotent original Invoice creation passes local tests. |
| Invoice issuance | READY — HOSTED VALIDATION REQUIRED | Issuance locks the snapshot and passes local tests. |
| Payment | READY — HOSTED VALIDATION REQUIRED | Transactional, append-only recording and balance invariants pass local tests. |
| Approval checklist | READY — HOSTED VALIDATION REQUIRED | Server-derived, fail-closed checklist passes local tests. |
| Initial availability | READY — HOSTED VALIDATION REQUIRED | Hash-bound, inclusive calendar-date check passes local tests. |
| Final availability | READY — HOSTED VALIDATION REQUIRED | Rechecked after sorted advisory locks inside Approval. Real sessions remain required. |
| Approval | READY — HOSTED VALIDATION REQUIRED | Transactional state/evidence protection passes local tests; hosted races remain. |
| Approval reversal | READY — HOSTED VALIDATION REQUIRED | Append-only reversal and resource release pass local tests. |
| Reapproval | READY — HOSTED VALIDATION REQUIRED | Re-runs all gates and creates new evidence locally; hosted walkthrough remains. |
| Legacy compatibility | READY | Local legacy request, Agreement, Invoice, scalar summary, route, and unverified-state coverage passes. |
| Authorization/RLS | READY — HOSTED VALIDATION REQUIRED | Local grant/RLS/JWT tests pass; hosted `app_metadata` accounts and Storage policies remain to prove. |
| Production rollout gates | READY | Browser default is disabled; database default is `false`. Activation is intentionally separate. |

No current item is classified `BLOCKED — ENGINEERING` from local evidence. Production activation remains blocked by hosted proof and the business decisions below.

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

Run this only after clean hosted migration and authorization validation. Use two active, different serialized catalog items and synthetic customer data.

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

Hosted evidence must include one serialized unit for August 10–12, a conflicting August 12–14 request, and an available August 13–14 request. Compare the public legacy RPC, initial confirmation, final Approval, and browser advisory result.

For cancellation, directly setting an Approved request to `cancelled` must fail. After `reverse_rental_approval()`, operational cancellation may proceed and the reversed rental no longer blocks solely because of its former Approval. Approved and Reversed events remain append-only.

For legacy compatibility, inspect representative existing fixtures without backfill: request, historical Agreement, historical Invoice, scalar equipment summary, archived equipment snapshot, `/admin/agreement/:id`, and `/invoice/:id`. No Approval event is fabricated; applicable legacy operational records display `legacy_unverified`.

## Release Configuration Audit

Never include values in release evidence.

| Setting/variable | Repository state | Release classification |
| --- | --- | --- |
| `VITE_ENABLE_MULTI_ITEM_RENTAL_REQUESTS` | Missing/anything except exact `true` resolves to false | INTENTIONALLY DISABLED |
| `private.release_feature_flags.multi_item_rental_requests` | Migration default `false` | INTENTIONALLY DISABLED |
| `RENTAL_DOCUMENT_MAX_BYTES` | Edge fallback and bucket constraint are 10,485,760 bytes | CONFIGURED; hosted override must be verified |
| `RENTAL_DOCUMENT_SIGNED_URL_TTL_SECONDS` | Edge fallback 120 seconds, clamped to 60–300 | CONFIGURED; hosted override must be verified |
| Approval `payment_policy` | Migration default `unconfigured` | CLIENT DECISION REQUIRED |
| `VITE_SUPABASE_URL` | Local variable name exists | CONFIGURED locally; preview identity unconfirmed |
| `VITE_SUPABASE_ANON_KEY` | Local variable name exists | CONFIGURED locally; value must remain unreported |
| `SUPABASE_URL` | Hosted Edge runtime requirement | HOSTED VALIDATION REQUIRED |
| `SUPABASE_ANON_KEY` | Hosted Edge runtime requirement | HOSTED VALIDATION REQUIRED |
| `SUPABASE_SERVICE_ROLE_KEY` | Hosted secret/server-only requirement | HOSTED VALIDATION REQUIRED |
| Staff/admin `app_metadata` | Account-specific | MISSING until hosted account audit passes |
| `VITE_N8N_RENTAL_REQUEST_WEBHOOK` | Existing browser integration variable | CONFIGURED locally; operational endpoint test required |
| `VITE_N8N_AUTOMATION_WEBHOOK_URL` | Existing browser integration variable | CONFIGURED locally; operational endpoint test required |

## Client Decisions and Release Blockers

### P0 — cannot release

No P0 implementation defect is known from local validation. Any public document access, migration failure, authorization bypass, corrupt payment balance, or two successful conflicting Approvals discovered in hosted testing becomes P0 immediately.

### P1 — resolve before activation

- Apply and validate every migration against hosted Supabase in actual order.
- Pass same-resource, multi-resource, disjoint-resource, and payment-policy hosted concurrency tests.
- Pass hosted Storage, Edge Function, compensation, signed URL, and authorization validation.
- Complete one synthetic hosted end-to-end walkthrough and legacy-route walkthrough.
- Audit actual staff/admin `app_metadata` and refreshed JWTs.
- Client selects `deposit_required` or `invoice_paid`; if deposit-based, define zero-deposit behavior.
- Client/counsel approves final Agreement, card-authorization, signature, and Business-signing wording.
- Client defines insurance coverage, effective/expiration rules, and verifier authority.
- Client approves identity/insurance retention and deletion procedures.
- Client confirms the operational Agreement/Invoice delivery and signature channel.
- Confirm the webhook endpoints and operational owners used during activation.

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
2. Validate clean and sequential migrations in hosted preview, then apply the same forward migrations to production.
3. Deploy/configure `rental-documents`; verify JWT enforcement and private bucket configuration.
4. Assign and verify trusted staff/admin `app_metadata`; refresh sessions.
5. Resolve and record all client/legal/insurance/retention decisions.
6. Set the chosen production payment policy through controlled database administration.
7. Run a non-destructive production configuration smoke test with synthetic/minimal data only where approved.
8. Enable the database `multi_item_rental_requests` gate.
9. Verify server RPCs, legacy behavior, and monitoring before exposing the browser path.
10. Deploy/configure `VITE_ENABLE_MULTI_ITEM_RENTAL_REQUESTS=true` and verify the built artifact.
11. Complete an operational request → Approval smoke test and route/PDF checks.
12. Monitor the signals below through the agreed observation window.
13. After sign-off, tag the reviewed `main` commit as `v1.0.0`.

Backend activation precedes browser activation so a stale/early browser cannot make the server accept unfinished writes. Readiness validation itself leaves both gates off.

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

As of the initial readiness review, no hosted test is marked passed: the available configuration does not prove an isolated preview target and lacks the required staff/admin/customer/service/database credentials. Record hosted project, date, operator, sanitized results, and evidence links here only after actual execution.

## Sign-off

| Area | Owner | Status/date |
| --- | --- | --- |
| Engineering/local validation | Readiness branch | Passed 2026-08-08 |
| Hosted migration/concurrency |  | Pending |
| Security/Storage authorization |  | Pending |
| Client operations/payment policy |  | Pending |
| Legal Agreement wording |  | Pending |
| Production activation approval |  | Pending |
