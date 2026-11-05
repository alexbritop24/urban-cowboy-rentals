# Release 1 closeout — November 4, 2026

This is a bounded finish-and-handoff pass. No Request Cart, customer accounts, automatic Square integration, inspection module, or redesign is included.

## Current evidence

- Owner approved the cleaned agreement on October 14. Browser/PDF integration and recorded signing-date support were merged and deployed in PRs 10 and 11.
- Live owner-approved terms activation is now verified: one approved clause enabled and its identical duplicate retained inactive. Historical Agreement and Invoice fingerprints matched before and after.
- Supabase and trusted Admin sessions are now available. Five live requests were inventoried. Record classification is awaiting the owner’s answer; none have been hidden or deleted.
- Earlier local validation recorded 39 persistence and 34 presentation/mapping passes. These are historical results, not new production verification.
- Existing readiness-runbook edits predate this pass and must be preserved.

## Remaining acceptance checklist

| Item | Evidence needed | Current state |
|---|---|---|
| Approved terms active | Exactly one enabled approved clause; new Agreement binds that version | Selection activated and verified; new-Agreement hosted smoke still pending |
| Clean dashboard | Inventory reviewed by ID; only confirmed tests classified; metrics exclude them; genuine rentals remain | Five requests inventoried; classification column installed; owner classification pending |
| Complete workflow | Request, exact-current document checks, actual acceptance, finalized Agreement, Invoice, recorded payment, availability, Approval | Fresh hosted validation pending |
| Legacy preservation | Earlier Agreement and Invoice PDFs still show original saved terms | Fresh check pending |
| Domains and access | Apex/www HTTPS/redirects; trusted staff/admin access; ordinary users denied | www HTTP 200; apex TLS failure (curl 35). Trusted Admin login/dashboard succeeded on retry; remaining role checks pending |
| Notifications/delivery | An authorized test notification arrives; PDF/signature delivery process is named | Receipt not proven by successful form submission |
| Release settings | Selected invoice_paid policy and ordered backend/frontend rollout are verified | Live payment_policy=unconfigured; backend multi-item gate=false; neither changed |
| Operations | Jason confirms insurance reviewer, document retention, delivery/signature steps, and support owner | Handoff discussion pending |
| Recovery/ownership | Correct account owner, recovery method, backup/export and restore responsibility documented without secrets | Pending |
| Jason acceptance | Jason can perform the daily workflow after walkthrough; release scope accepted | Guide prepared; session not yet held |

## Execution order

1. Sign in and run the read-only inventory SQL. Preserve the result privately; do not commit customer records or credentials.
2. Resolve approved-clause state using the duplicate-safe operation only if still needed.
3. Review every request ID and its related records. Unknown records remain real/unclassified; never infer test status solely from age, a name, or email pattern.
4. Install the reversible test-classification column and compatible app; flag only confirmed test IDs. Do not remove customers, users, catalog equipment, agreements, invoices, payments, documents, or audit events.
5. If a test has an active booking/Approval, hiding it is not cancellation. Review its lawful cancellation/reversal separately; preserve all audit evidence.
6. Run the hosted walkthrough in the retained validation environment. Do not pollute production with another fake rental merely to demonstrate.
7. Verify the intended production gates, policy, notifications, domains and existing PDFs; obtain any required final rollout authorization.
8. Deliver Jason's guide, a 30-minute walkthrough, secure account access, and a signed-off remaining-issues list. Future additions are outside this release.

Do not call Release 1 complete just because deployment succeeds or the dashboard is empty.

## Verification performed in this finishing pass

- Reversible classification database test passed: existing rows default visible; anonymous update denied; repeated migration preserves a classification; locked Agreement/item snapshots unchanged; restoration works; new genuine requests default visible.
- Dashboard filter test passed: only explicit boolean true is excluded; names are not evidence of test status; legacy and missing metadata stay visible.
- Application/Node TypeScript checks, focused dashboard lint, production build, and diff whitespace check passed. Existing large-chunk warning remains.
- HTTPS probe: www returned HTTP 200; apex returned no HTTP response because TLS failed. Neither private Supabase data nor a signed-in Admin session was available.
- No production records were deleted, reclassified, exported, or otherwise changed in this pass. No account credentials were created or shared. No deployment or rollout activation was performed.

## Live preparation and preservation record

The intended production project was verified in the Supabase header before operations. The duplicate-safe terms selector activated exactly one owner-approved clause. The reversible classification column was installed with all five requests still false. There are 17 Agreements, 2 Invoices, 3 automation events, and zero recorded Payments, document records or Approval events in this inventory. No customer data was exported to the repository.

Before/after counts and fingerprints matched for requests (excluding the new classification metadata and update timestamp), Agreements, Agreement items, Invoices, Invoice items, Payments, documents, Approval events, availability checks, and automation logs. No existing snapshot, acceptance, invoice, payment or audit record was rewritten.

Latest local checks: 40 persistence tests and 35 presentation/loader tests passed; TypeScript, focused lint, and production build passed. Actual classification and final live clean-dashboard observation remain pending the owner's record-identification answer.
