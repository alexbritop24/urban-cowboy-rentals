# Agreement field-population refinement

**REVIEW DRAFT — NOT FOR CUSTOMER SIGNATURE — SAMPLE DATA**

Updated PDF: `urban-cowboy-jason-agreement-populated-review.pdf`, **18 pages with natural pagination**. The original 16-page design review remains available unchanged. The same branded header/footer, colors, typefaces, table styles, and signature-line styles are used. Additional space comes from the populated snapshot details and explicitly labeled evidence/reference sections, not a forced page count.

The PDF uses the existing fictional local Agreement fixture: Jordan Sample / High Desert Sample Services LLC, Agreement `UCR-2028-000042`, three independently scheduled units. Its dates, contacts, charges and evidence are synthetic examples. Nothing was fetched from production or recorded as a new signature/authorization. The fixture's $120/$180/$225 daily rates demonstrate reading recorded item values; they are not new price proposals or substitutions from today's catalog.

## Fields populated automatically

- Company name, street/locality, phone and email from the existing document-brand constants.
- Agreement number and stored effective date; lessee legal name; business name; customer email/phone; Agreement billing and service/delivery addresses; recorded fulfillment; stored summary start/end dates. The preamble and lessee-name/phone placeholders use the same legal-name/contact meanings as the current Agreement.
- Delivery location only when the snapshot explicitly records delivery and a service address. No pickup location or delivery date is inferred.
- Every item's equipment name, quantity, serial/VIN, own dates, daily rate, recorded billable days, line amount and item notes. All units appear in the Exhibit A transaction schedule and Exhibit D unit reference.
- Recorded subtotal, deposit, delivery, tax and total, without recomputation or suggested-deposit defaults. Zero values remain zero.
- Recorded signer name/title and recorded acceptance timestamp, explicitly labeled as **acceptance of the stored Agreement only**. No signature image, execution of this proposed draft, or Jason signature is fabricated.
- Schedule 1 customer/rental context: number, lessee/business name, contacts, Agreement billing address, rental summary, equipment, deposit and total. Stored provider-safe authorization wording, acknowledgment state and timestamp are shown separately. These do not establish a cardholder identity or acceptance of Jason's proposed authorization language.

All transaction data comes from the supplied persisted Agreement snapshot and its item snapshots. There are no catalog, customer-profile, Invoice, payment-provider, or hosted lookups. Jason's source Exhibit A/B/C reference tables and amounts remain unchanged and explicitly separated from actual transaction data; earlier pricing, insurance, deposit, and legal-policy conflicts remain unresolved.

## Remaining fields and exact decisions

| Unresolved field / issue | Smallest resolution; finalization decision |
| --- | --- |
| State of organization, entity type, source's fixed “UTAH,” and broken §14.1 placeholder | These are not persisted. Owner/counsel must approve how business-entity particulars are completed externally or approve wording that uses the existing Individual/Business classification. Do not infer entity type from “LLC” in a business name. |
| `[its principal place of business/an address]`, business/principal address | Confirm whether the stored billing address is intended to serve as the contractual notice/business address and approve the appropriate address alternative. It is not automatically a registered/principal address. The billing address is already displayed with its correct label. |
| Business-only representations for individual renters | Approve individual alternatives for the preamble and Sections 14-16. Individual mapping leaves entity particulars unresolved, does not invent a business or signer title, and marks these source representations as inapplicable/unresolved. No substantive wording was silently removed. |
| Distinct delivery date; global versus per-unit term | Approve whether §3 should refer to the existing scheduled rental-start field, or complete an actual separate delivery date externally. Confirm global-term/per-unit precedence; the mapper uses stored summary and individual dates without calculating substitutes. Pickup location remains unresolved unless recorded data establishes it. |
| Lessor execution/signature/date; execution/acceptance of proposed terms | Obtain actual execution evidence through the authorized existing process, or approve a wording/evidence convention appropriate to that process. Jason's printed name/title are source designations only. Staff attribution is not Jason's signature. Old acceptance cannot be transferred to these replacement terms. |
| Cardholder identity, provider/card identification, separate cardholder signature/date | Approve a provider-safe replacement that matches the existing recorded acknowledgment and payment-provider handling, including the “listed below”/“identified above” references and charge categories. Customer/signer names and Agreement billing address are not proof of cardholder identity or card billing details. The separate cardholder fields remain unresolved. |
| Source reference equipment/rates/deposits and remaining policy conflicts | Approve transaction/reference precedence and resolve the previously documented source conflicts before this can be a final customer Agreement. No source amount, rate rule, insurance gate, RDW, or deposit policy changed in this task. |
| Exhibit D invoice number, actual checkout/check-in date/time, meters, fuel, condition, return charges, operational signatures/dates | These are not in an Agreement snapshot. Complete the existing operational inspection records at the appropriate stage; do not reuse rental dates, item notes, Agreement acceptance, or Agreement number as those facts. These are operational blanks, not new application gates and not a request to digitize inspections. |

The first seven rows contain contract/wording/evidence blockers to a final signable replacement; the last row concerns separate operational evidence. Required unresolved contract fields are visible as `[UNRESOLVED: …]`. Inspection blanks use `[UNRECORDED: operational evidence]`. Missing supported fields are also marked rather than filled from convenient alternatives.

## Optional field omissions

The previously documented Schedule 1 full card-number/CVV fields and card-retention clause remain omitted. In this refinement, these optional card-data blanks are additionally omitted because the Agreement has no authoritative equivalents:

- `Expiration Date: _____________`
- `Billing ZIP Code: _______________________`
- `Billing Address: _______________________________________`
- `City/State/Zip: _______________________________________`

These are field labels, not substantive consent wording. Agreement billing address remains visible as **Agreement billing address**, not card billing address. For individual renters only, an empty lessee `Title:` field is omitted when no applicable title is recorded. The source authorization prose remains for review, with unresolved cardholder particulars and the provider-safe replacement-pending notice.

## Verification and smallest remaining work

Five focused mapping checks passed: authoritative snapshot use and source-table preservation; no mutations; pending/stale evidence; individual renters; zero amounts and missing dates/addresses; unverified-snapshot refusal and provider-data exclusion/redaction. The rendered PDF content check passes for every mapped paragraph, field, table cell and note, including complete stored-evidence references. All 18 pages have draft/sample markers and branded footers. Every page was visually reviewed; long evidence references wrap cleanly.

The initial mapping is in `scripts/review-agreement/placeholder-mapping.md`. Population is a pure review-only function in `populate-review.mjs`. Reproduce with Node 22.23.1:

```sh
node --test scripts/review-agreement/population.test.mjs
node scripts/review-agreement/generate-review.mjs --populated
node scripts/review-agreement/verify-review.mjs --populated
node scripts/review-agreement/render-review.mjs --populated
```

The smallest remaining work is to obtain the specific wording/evidence decisions above, make only those approved document substitutions, and regenerate from the applicable Agreement snapshot with genuine new execution/consent evidence when authorized. No new forms or schema are needed for the supported mappings. Activation/versioning of replacement terms remains separately authorized work; it was not started here.

Active application code, models, database/schema, hashes, locking, acceptance/authorization workflows, calculations, insurance gates, rollout flags, Invoice, specification and the pre-existing readiness edit remain unchanged. Nothing was staged, committed, pushed, deployed or applied to hosted services.
