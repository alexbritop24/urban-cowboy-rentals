# Release 1 Rental Approval Workflow

## Boundary and State

Rental Approval is a dedicated operational decision attached to `rental_requests`. It does not reuse the request's broader operational `status`, and manually setting a legacy request status never creates Approval evidence. Current state is stored as `pending`, `approved`, or `reversed`; historical operational records with no Approval event are presented as `legacy_unverified` rather than receiving fabricated audit history.

`rental_approval_events` is the append-only Approval/reversal history. `rental_availability_checks` is the append-only initial/final availability history. Direct inserts, updates, and deletes are blocked by grants, RLS, and database triggers. Trusted RPC transaction contexts are required even for roles that bypass RLS, so service-role access cannot silently rewrite history.

Every newly inserted request must begin with `approval_status = pending` and null Approval/reversal evidence. This is enforced by the database trigger even for privileged inserts. An Approved request cannot be changed directly to legacy `cancelled`; staff must first use the audited reversal workflow. An authoritative Approved request continues blocking its resources regardless of legacy status as defense in depth.

## Checklist Sources

The checklist is produced by `get_rental_approval_checklist()` and derives its state from existing authoritative records:

- Item data and schedule identity come from finalized `agreement_items` when a finalized Agreement exists; otherwise they come from normalized `rental_request_items`.
- Current driver-license and insurance status comes from `rental_documents`.
- Insurance passes only when the request's review evidence identifies the exact current insurance document.
- Card authorization, customer acceptance, finalized state, and snapshot integrity come from the immutable Agreement.
- Payment comes from the original Agreement-derived Invoice and its server-maintained payment totals.
- Initial and final availability come from append-only checks bound to the current deterministic schedule hash.

The React checklist is informative. `approve_rental_request()` independently repeats all critical checks in its transaction.

## Availability and Schedule Invalidation

The schedule fingerprint is SHA-256 with the repository-standard `sha256:` prefix and hosted-Supabase `extensions.digest()` qualification. Its canonical JSON contains resource identity, equipment ID, serial snapshot where present, UTC start/end timestamps, and quantity in deterministic order. Names, notes, and prices are intentionally excluded because they do not change physical availability.

Availability uses inclusive UTC calendar-date ranges: two schedules conflict when each starts on or before the other ends. The ending calendar date remains occupied, so an August 10–12 rental conflicts with a rental beginning August 12 and permits the same unit to begin next on August 13. The legacy availability RPC, browser advisory check, initial check, and final Approval check share this rule. A serialized unit uses its normalized serial snapshot as the resource key. Other Release 1 items use the stable equipment ID because normalized inventory capacity is deferred. Missing safe resource identity fails closed.

An initial check remains historical when the schedule changes, but its hash no longer matches and the checklist reports `stale`. A conflict result never satisfies the initial gate. Final availability is not reusable preapproval evidence; it is created only inside the Approval transaction.

## Transaction and Concurrency Model

Approval performs the following sequence in one database transaction:

1. Authenticate trusted `app_metadata` staff/admin and require a valid actor UUID.
2. Lock the target request.
3. Hold a shared row lock on the protected global payment policy so it cannot change during evaluation.
4. Lock the finalized Agreement and original Invoice rows.
5. Revalidate every non-availability checklist gate, including that locked payment policy.
6. Resolve resource keys exclusively from the stored authoritative schedule.
7. Acquire transaction-scoped PostgreSQL advisory locks for distinct resource keys in sorted order.
8. Re-run the canonical overlap query after all locks are held.
9. Append the final availability check.
10. If available, append the Approval event with the evaluated payment-policy snapshot and update current Approval state before commit.

Competing approvals for the same physical resource therefore serialize. The waiter rechecks after the first transaction commits and observes its Approval. `SELECT ... FOR UPDATE` alone is not used as the resource lock because it cannot lock an absent conflicting row. PGlite verifies lock ordering and transactional sequencing, but a true multi-session concurrency test on hosted PostgreSQL remains a production-activation requirement.

Final conflict checks return a structured denial and retain the failed check without creating an Approval event. Other prerequisite failures raise an actionable error and do not partially mutate Approval state.

## Payment Policy

The protected Release 1 payment policy defaults to `unconfigured`, which fails closed. It is not editable by ordinary staff and request-level payment/deposit summaries are ignored. Prepared policies are:

- `deposit_required`: the original Invoice must be issued and authoritative `amount_paid` must meet its stored deposit requirement.
- `invoice_paid`: the original Invoice must be issued, paid in full, and have coherent zero-balance/payment state.

Selecting the production policy remains a client decision and is required before activation.

Ordinary anonymous, customer, and staff roles cannot update the global policy. Successful Approved events permanently snapshot `deposit_required` or `invoice_paid`; reversal events contain no payment policy, and `unconfigured` can never appear on a successful Approved event.

## Reversal and Compatibility

Reversal appends an event and updates current Approval state without changing Agreements, Invoices, Payments, Documents, or prior availability checks. Reapproval runs every gate again and creates a new final availability check and Approval event.

Existing routes and legacy scalar fields remain. Initial confirmation mirrors its result into the legacy availability summary only so existing Agreement creation continues working; the hash-bound check remains authoritative for Approval. No historical rows are bulk converted.

## Production Activation Requirements

- Select the trusted payment policy after client approval.
- Run a true multi-session same-resource Approval race against hosted Supabase/PostgreSQL and confirm one transaction waits and then fails its conflict recheck.
- Apply migrations sequentially in a hosted preview and verify grants, RLS, fixed `search_path`, and managed-schema compatibility.
- Complete staff acceptance testing for checklist messages, reversal authority, and legacy/unverified records.
- Keep existing Release 1 rollout gates disabled until their separate activation decision.
