# Urban Cowboy Rentals — Release 1 Production Implementation Specification

## 1. Release Objective

Release 1 delivers the urgent, production-usable path from a rental request to a completed rental agreement, original invoice, payment record, required document uploads, and staff approval. It extends—not replaces—the current `rental_requests → rental_agreements → invoices` flow and keeps the existing application deployable while the larger ERP model remains deferred.

The release is successful when staff can process a request containing one or more independently scheduled equipment items, prevent premature agreement finalization, produce agreement and invoice PDFs, record payment, and clearly determine whether the rental is approved.

## 2. Current Production State

The React/TypeScript/Vite application uses Supabase. The public form creates `rental_requests`; the protected dashboard reviews availability, quote, deposit, payment-link, and operational statuses. Staff create or reopen one agreement at `/admin/agreement/:id`, finalize its legal-clause snapshot, then create or reopen one invoice at `/invoice/:id`.

Current request, agreement, invoice, and PDF views assume one equipment description and one rental date range. Agreement finalization currently checks only that legal clauses exist. The signature section is presentational. PDFs are generated in the browser with `@react-pdf/renderer` and are not stored as canonical artifacts. Invoices support draft editing, issue-time locking, payment history, partial/full payment, and manual payment methods. The request dashboard also supports a Square payment link. No production upload or complete approval-gate workflow exists.

## 3. Scope

Release 1 includes:

- Multi-item request entry and staff editing, with independent start date, end date, quantity, daily rate, serial number, and notes per item.
- One legal agreement and one original invoice per rental request.
- Individual or Business customer selection, with business name when applicable; no reusable customer profile.
- Agreement rendering and PDF output containing customer details, item schedule, pricing, legal clauses, credit-card authorization, and signature/acceptance fields.
- Invoice rendering and PDF output containing itemized billing, totals, payment status, amount paid, and balance due.
- Required driver-license and insurance uploads, insurance verification, availability confirmation, and a visible approval checklist.
- Existing invoice issue and partial/full payment recording.
- Section 6 catalog updates, server-enforced authorization, and private identity/insurance storage.

The Release 1 persistence contract is additive and normalized. `rental_request_items`, `agreement_items`, and `invoice_items` are authoritative child collections for new multi-item rentals. Each row has stable and parent IDs, display order, equipment ID/name, dates, quantity, daily rate, serial number, notes, billable days, and line total. Agreement items snapshot request terms; invoice items snapshot finalized billing. Each physical serialized unit is a separate row with quantity normally `1`. Legacy scalar fields remain temporarily. Exact SQL is an implementation task; this specification includes no migration.

## 4. Out of Scope

- Future ERP architecture, rental aggregate, normalized inventory/assets, and reusable customer profiles.
- Customer account or customer route.
- Canonical immutable PDFs, document versioning, and general document management.
- Digitizing the full inspection, damage, repair-charge, return, and returning-customer workflows. Associating the approved inspection reference PDFs with serialized equipment remains in scope.
- Automated card capture/charging, refunds, accounting sync, tax engine, credit notes, and invoice replacement.
- Automated insurance validation, OCR, identity verification, or e-signature vendor integration.
- Bulk legacy backfill. Legacy records must work without conversion.

## 5. Business Workflow

1. A customer submits an Individual or Business request with one or more equipment items. Each item has its own dates and quantity; staff may complete rate, serial number, and internal item notes.
2. Staff review conflicts per item/date range and explicitly confirm availability. A single conflict keeps the request unapproved.
3. Staff create or reopen the one agreement associated with the request. The agreement receives a snapshot of customer, item, price, and legal-clause data so later catalog edits do not change it.
4. Staff obtain the driver license and insurance files, verify insurance, complete the credit-card authorization and signature/acceptance steps, and satisfy every finalization gate.
5. Finalizing locks the agreement snapshot. Failed gates return specific messages and do not partially finalize.
6. Staff create or reopen the one original invoice, review its itemized snapshot, issue it, provide the invoice/payment link externally, and record payments.
7. Immediately before final approval, the system revalidates availability for every item and date range. The rental becomes Approved only when that recheck passes, the agreement is final, required uploads/verification are complete, and the configured payment/deposit condition is met. Approval records actor and timestamp. In this sequence, “agreement final” means all agreement prerequisites are complete; payment is the subsequent rental-approval gate because the original invoice is created from the finalized agreement.

Release 1 is staff-mediated through the client’s existing external channel; no public customer portal is required.

## 6. Agreement Requirements

The agreement is the legal source of truth. It must show agreement number/status; customer type; legal name, email, and phone; business name for Business customers; fulfillment method; every equipment item and its dates, quantity, daily rate, serial number, notes, billable days, and line amount; subtotal, deposit, delivery, tax, and total; the frozen legal clauses; credit-card authorization; and signature/acceptance evidence.

Agreement numbers must be generated authoritatively by trusted server/database logic, be unique and collision-safe, and not rely on browser timestamps as the long-term mechanism. The exact display format remains a client/accounting decision.

Credit-card authorization must be part of the agreement rather than the invoice. Release 1 must not store a full card number or CVV. The agreement should authorize agreed charges against the card handled through the approved payment provider and may identify it by cardholder, brand, and last four digits only. Final legal wording and authorized charge categories require client approval.

Until a third-party e-sign provider is selected, minimum signature/acceptance evidence is the signer’s typed legal name, an explicit agreement checkbox, timestamp, exact agreement version/snapshot reference, and staff attribution where applicable. Whether this evidence is legally sufficient requires client and attorney approval before public launch.

Finalization is denied unless all required customer fields are present; there is at least one valid item; every item has valid dates, quantity greater than zero, nonnegative rate, the required serial count, and resolved availability; totals are valid; legal clauses exist; driver license and insurance are uploaded; insurance is verified; credit-card authorization is acknowledged; signature/acceptance evidence exists; and no blocking conflict remains. The gate must run in the data-access layer as well as the UI.

Catalog behavior for this release:

- **2024 Bobcat T550 Track Loader** — serial **B57T133070**, daily rate **$120/day**.
- **2025 Bobcat E35 Compact Excavator** — serial **B57920400**.
- **2025 Wacker Neuson Roller Compactor** — serial **WNCRD12AEPUM06214**; this is the current Wacker Neuson RD12 Roller catalog unit and remains active.
- Archive **2025 RawMax Tilt Deck 22'** and **Utility Trailer** so they cannot be selected for new requests; retain historical display by stored snapshots.
- Catalog items independently support active/archive status, `featured`, and `most_popular`. The **🔥 Most Popular** badge is metadata-driven, reusable, and not hard-coded to one item or card.
- Do not invent identifiers for any additional serialized units; they require client confirmation before finalization.

### Sprint 1 Catalog Outcome — Approved

Sprint 1 archived **2025 RawMax Tilt Deck 22'** and **Utility Trailer** while retaining their records and stable IDs for historical display and direct-detail compatibility. Archived items no longer appear in new-request selectors. The existing Bobcat ID now displays **2024 Bobcat T550 Track Loader** at **$120/day**. Confirmed internal serial metadata was added for that Bobcat, the **2025 Bobcat E35 Compact Excavator**, and the **Wacker Neuson RD12 Roller**; public pages do not render serial numbers, VINs, or asset identifiers.

The reusable **🔥 Most Popular** badge is enabled through metadata for the Bobcat and Wacker Roller. The Wacker is included on the Home page through centralized active/featured selectors, without duplicated Home-page components. Lint and the production build passed. No Agreement or Invoice code changed.

### Preferred Future Catalog Metadata

The preferred future shape groups catalog behavior and supports reusable badges without adding one Boolean for every label:

```ts
catalog: {
  status: "active",
  featured: true,
  badges: ["most-popular"]
}
```

- `status` controls active/archive behavior.
- `featured` controls Home-page inclusion.
- `badges` is a reusable collection. Supported future values may include `most-popular`, `new`, `best-value`, `limited-availability`, `commercial-favorite`, and `seasonal`.
- Public components should map supported badge values to shared renderers; they must not branch on equipment IDs.

This refactor is deferred and must not block Sprint 2. The Sprint 1 `mostPopular` implementation remains acceptable for Release 1 unless the metadata-collection refactor is explicitly scheduled.

### Inspection Reference Documents

The supplied check-in/check-out PDFs are the client-approved inspection references for the three units above. The Agreement must identify the serialized equipment and related form. These PDFs may remain operational for Release 1; the release does not digitize the full inspection workflow.

The forms contain invoice number; customer name; check-out/check-in date and time; hour meter; total hours used; fuel level; employee/representative; equipment-specific condition ratings; photo documentation; existing and newly identified damage; missing equipment/accessories/attachments; additional return charges; damage-responsibility notice; damage determination; customer acknowledgement; and check-out/check-in certifications.

A future inspection module must support equipment-specific templates rather than one universal checklist. Inspection records must eventually link to the specific serialized unit, rental/request, customer, invoice, staff member, photos, and signatures.

## 7. Invoice Requirements

The invoice is billing, not the legal agreement. Creation is idempotent by agreement: reopening returns the existing original invoice and never silently creates another. Customer and line-item data copy from the finalized agreement.

Invoice numbers must be generated authoritatively by trusted server/database logic, be unique and collision-safe, and not rely on browser timestamps as the long-term mechanism. The exact display format remains a client/accounting decision.

Each invoice line shows equipment description, service dates, quantity, daily rate, billable days, and amount. Deposit, delivery, tax, total, amount paid, and balance due remain separate summary values. Currency math uses integer cents or equivalent exact decimal handling and a documented inclusive/exclusive day rule.

Draft financial data may be corrected before issue. Issuing records the timestamp and locks billable fields. Issued, partially paid, paid, overdue, and cancelled states must remain coherent with payment totals. Post-issue correction behavior is a remaining client decision; Release 1 must not create replacement invoices implicitly.

## 8. Document Upload Requirements

Driver license and insurance are mandatory, separate upload slots on the protected agreement workflow. Accept PDF, JPEG, and PNG; enforce a configurable size limit; reject mismatched file types; show file name, upload time, uploader, and replacement state. A replacement must clear prior insurance verification.

Files must use private Supabase storage, randomized object paths, authenticated staff access, short-lived signed download URLs, and restrictive storage policies. Do not expose permanent public URLs or log document contents. Database records store storage paths and metadata, not base64 file content. Production retention/deletion policy requires client confirmation.

## 9. Approval Requirements

The UI presents one checklist with independently auditable statuses: item data complete, initial availability confirmed, driver license uploaded, insurance uploaded, insurance verified, credit-card authorization acknowledged, customer signature/acceptance captured, agreement final, required payment/deposit satisfied, and final availability revalidation passed.

Only authorized staff may verify insurance, finalize, approve, or reverse approval. Each action records actor and timestamp; optional notes record exceptions, but Release 1 provides no bypass for mandatory gates. Availability must be revalidated immediately before final approval, not merely during initial review. Editing an item schedule, replacing insurance, or changing prerequisite data invalidates the affected confirmation and requires review. Finalized legal/price snapshots remain locked.

## 10. Payment Requirements

Keep the existing invoice-led workflow: issue the invoice before recording payment; allow cash, card, check, ACH, Square, Stripe, or other with amount, received time, optional reference, and notes; reject zero, negative, or over-balance payments; update amount paid, balance due, paid timestamp, and partial/paid state.

Continue supporting the current Square payment-link field as a staff-managed external link. Do not collect raw card details in this application. Payment write and invoice-balance update must be atomic or made safely retryable so a recorded payment cannot leave the invoice stale. Refund processing and payment-provider webhooks are outside scope.

## 11. Compatibility Requirements

- Preserve `/admin/agreement/:id` and `/invoice/:id`, their authentication behavior, and current record identifiers.
- Preserve the `rental_request_id` and `rental_agreement_id` links and one-agreement/one-invoice lookup behavior.
- Read normalized child items when present; otherwise adapt legacy `equipment_requested`, `rental_start_date`, `rental_end_date`, `rental_duration`, and existing totals into a single display line without changing the stored legacy row.
- Continue rendering and generating PDFs for legacy single-item agreements and invoices.
- Keep existing scalar fields during Release 1. For new multi-item records, populate a human-readable scalar summary where existing dashboard/search code depends on it; item snapshots are authoritative for itemized rendering.
- Archived catalog items remain visible on historical records and direct historical views, but disappear from new-request selectors.
- No route removal, bulk backfill requirement, or destructive schema change is permitted.

## 12. Risks

- Legal and PCI exposure if credit-card authorization text or data collection is improvised.
- Private identity documents require correct row-level and storage policies; a public bucket is a release blocker.
- Client-side-only finalization checks can be bypassed; protected writes need server/data-layer enforcement.
- Multi-item availability can race between review and approval and must be rechecked at confirmation.
- Browser PDFs are reproducible views, not immutable evidence; this limitation must be disclosed operationally.
- Normalized child items require parent/child integrity, transaction boundaries, snapshot rules, and legacy adapters.
- Browser-timestamp agreement/invoice numbers can collide or be forged; authoritative numbering is required.
- Agreement/request/invoice statuses can drift unless transitions and terminology are aligned.
- Payment updates can diverge without atomicity/idempotency.
- Date boundaries, timezone, billable-day convention, taxes, deposits, and rounding can change totals.

## 13. Milestones

1. **Data and catalog:** child tables/storage policies, validator/legacy adapter, authoritative numbering, customer type, serialized metadata, catalog changes, and status alignment.
2. **Multi-item workflow:** request/admin editor, per-item availability/calculations, agreement snapshot, and legacy coverage.
3. **Agreement and approval:** private uploads, insurance verification, signature/authorization, gates, and PDF.
4. **Invoice and payment:** item snapshot/PDF, idempotent invoice, issue locking, safe payments, and payment gate.
5. **Readiness:** permissions, retries, new/legacy fixtures, browser/mobile checks, walkthrough, and sign-off.

### Sprint 1 Approval Record

- **Status:** Approved
- **Branch:** `feat/agreement-invoice-release-1`
- **Scope completed:** Catalog archive behavior, Bobcat identity/rate, serialized-unit metadata, ordering, reusable Most Popular badge, Home-page featured metadata, and historical compatibility.
- **Validation completed:** Full lint and production build passed.
- **Protected scope:** No Agreement or Invoice code changed.
- **Next gate:** Ready to proceed to Sprint 2 after ERD review.

## 14. Acceptance Criteria

- A request with at least two items having different dates, rates, serials, and notes flows through normalized child rows into exactly one agreement and one original invoice without data loss.
- Individual and Business agreements render correctly; Business requires a business name. Totals follow approved day-count and rounding rules.
- Finalization returns actionable errors for missing uploads, verification, signature/authorization, item fields, availability, clauses, or invalid totals.
- Insurance replacement clears verification; unauthorized users cannot access documents or protected approvals.
- Final agreements retain locked clause/item snapshots and render PDFs; invoice creation is idempotent, issue locks billing, and PDFs show every line/payment total.
- Partial/full and invalid/duplicate payments preserve correct history and balances.
- Approval is impossible until all configured gates pass, availability has been revalidated immediately beforehand, and the approval actor/time are recorded.
- Existing single-item agreement/invoice fixtures still load and generate PDFs at the unchanged routes.
- Archived items cannot be newly selected; historical references still render; catalog status, `featured`, and `most_popular` are independent; and the reusable badge renders only from metadata.
- The three confirmed serialized units and their inspection references are associated correctly in agreements and historical views.
- Production logging contains no document contents, raw card data, or signed storage URLs.

## 15. Remaining Client Decisions

1. Select exact display formats for collision-safe Agreement and Invoice numbers.
2. Approve final Agreement clauses, credit-card authorization wording, authorized charge categories, signature evidence, and Business signing authority with counsel.
3. Confirm the payment/deposit threshold for approval and whether payment must precede Agreement finalization.
4. Define tax, inclusive/exclusive day count, timezone cutoff, deposit/delivery treatment, due dates, and rounding.
5. Define insurance coverage, effective-date/expiration rules, and authorized verifier roles.
6. Set upload size/type limits, retention/deletion policy, and whether a signed Agreement PDF is also required.
7. Define post-issue Invoice correction/cancellation and mistaken-payment handling.
8. Select the operational delivery/signature channel until a customer route or e-sign provider exists.
9. Confirm whether any additional serialized units still need identifiers.

## 16. Release 1 Definition of Done

- Multi-equipment requests work, and each serialized unit appears separately with quantity normally equal to `1`.
- One Agreement covers all items; one original Invoice covers all items; independent dates and rates are preserved.
- Required documents upload privately; insurance can be verified; availability is rechecked immediately before approval.
- Credit-card authorization is included safely, signature/acceptance evidence is recorded, and no prohibited card information is stored.
- Agreement and Invoice PDFs render correctly, and payments cannot corrupt invoice balances.
- Legacy single-item records work; existing routes and IDs remain valid.
- Archived equipment cannot be selected for new requests, while historical records still display it.
- The 2024 Bobcat T550 Track Loader (**B57T133070**), 2025 Bobcat E35 Compact Excavator (**B57920400**), and Wacker Neuson RD12 Roller (**WNCRD12AEPUM06214**) retain confirmed internal serial metadata without exposing it on public pages.
- The Bobcat and Wacker Roller receive the shared Most Popular badge through metadata, and the Wacker appears on the Home page through the centralized featured selector.
- Inspection reference documents are associated with the correct equipment.
- Final legal wording is approved before public launch.
