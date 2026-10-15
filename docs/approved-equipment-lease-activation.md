# Approved equipment lease activation

Owner approval was confirmed in the project chat on October 14, 2026. This replaces the earlier review-only status for the cleaned agreement. Existing pricing, recorded deposits, insurance verification, and payment workflow remain in effect; this implementation adds no new business workflow.

## Implementation

The approved source document, including its tables, is stored as the body of a versioned `ucr_document_v1` clause. New Agreements freeze that clause through the existing snapshot/hash/acceptance mechanism. The browser and the single Agreement PDF action render that Agreement's frozen source plus its recorded transaction data. They never load the current clause catalog to render history. Earlier drafts and accepted Agreements keep their original saved terms.

The versioned population mapping preserves the cleaned review's approved opening paragraph and source sentence repair. Unknown entity particulars, separate delivery dates, lessor execution, cardholder signatures, and inspection facts remain blank rather than invented. Actual matching acceptance/payment-authorization evidence is shown separately. Provider-safe authorization terms come from the Agreement snapshot; no raw card-number/CVV fields are collected.

## Deployment sequence

1. Commit/push the application and inactive preparation migration on the feature branch. Review the compatible deployment before activation.
2. Apply `20261014000100_approved_equipment_lease_terms.sql` to the intended database. It only installs the new clause **disabled**, leaving the active selection and all business records unchanged. Normal migration tooling must verify the intended target.
3. Deploy the compatible application and verify its version and staff Agreement route. Confirm legacy downloads remain available.
4. Run `supabase/operations/activate-approved-equipment-lease.sql` against that intended database. It atomically selects the prepared clause for future Agreement creation only. It aborts unless exactly one prepared version exists.
5. Verify a newly created test Agreement freezes the `ucr_document_v1` clause, presents the full document, and downloads through the single PDF button. Acceptance must bind its new terms/material hashes. Use an isolated validation environment for the full creation/acceptance/finalization/Invoice/Payment/Approval smoke test before production activation.

Do not rewrite prior drafts or transfer old acceptance to the replacement terms. An existing draft requires the established cancellation/replacement procedure if it must use the new terms.

The local sample at `output/pdf/urban-cowboy-approved-agreement-sample.pdf` is explicitly marked SAMPLE DATA and is not an executed customer contract.
