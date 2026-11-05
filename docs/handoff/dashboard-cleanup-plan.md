# Dashboard test-data cleanup

## Goal

Jason sees genuine operating data rather than development demonstrations. Use reversible classification instead of wiping the database. A fresh dashboard does not require resetting identifiers, invoice numbering, customer accounts, or legal history.

## Inventory first

Run `supabase/operations/release1-dashboard-inventory.sql` in the intended Supabase project. It is read-only and returns request identifiers, names, dates, source and dependency counts, plus active terms and release settings. It does not retrieve card data or document contents.

For each ID record: confirmed test / confirmed real / unknown, evidence for the decision, related locked Agreements/Invoices/Payments/Approvals, proposed action, and whether availability remains affected. No record is currently selected. Unknown records stay visible.

## Reversible implementation

The new forward migration adds `rental_requests.is_test_data` defaulting to false. The default dashboard list and totals exclude only literal true. Older schemas/records without the property remain visible. There is no bulk-delete action and no public test-classification form.

After deploying the compatible code and applying the migration, prepare a small ID-specific SQL transaction from the reviewed inventory. It must first verify each expected ID/name, then set is_test_data=true only for those IDs, return the changed IDs, and leave all other columns unchanged. Do not run an unscoped UPDATE or use name/email-pattern deletion. Keep a private record of the previous flag values.

Restore a classified request by resetting its flag to the recorded prior value for that exact ID. Nothing was deleted. Agreement, Invoice, Payment, document, acceptance, review and audit records remain unchanged. Availability continues using all records; resolve a test's live reservation separately through the established audited workflow.

## Verification

Compare before/after record counts and protected snapshot hashes. Jason's visible count, list and totals must match the remaining genuine requests. Refresh must preserve the clean state. A new genuine request defaults visible. Earlier document links must still work for authorized staff. Confirm the equipment catalog and staff accounts are unchanged.

## Current status

Live inventory found five requests. The classification column is installed; all five remain unclassified/visible. Counts and protected-record fingerprints match before/after preparation. The owner’s classification answer, compatible dashboard deployment and final clean-dashboard observation remain pending. No production record has been removed or hidden. Test-linked global automation entries are also excluded from the default view once their request is explicitly classified; unlinked/system entries remain visible.
