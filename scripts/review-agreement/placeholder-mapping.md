# Existing-field mapping (review-only population)

Only the supplied persisted `RentalAgreement` snapshot and its `items` are read. Company identity comes from the existing `urbanCowboyDocumentBrand`. No catalog, profile, invoice, provider, or hosted lookup is used.

| Placeholder / displayed field | Existing source | Resolution |
| --- | --- | --- |
| Company name/address/phone | `urbanCowboyDocumentBrand` | Populate existing branding and company literals. |
| Agreement number; agreement “dated as of” | `agreement_number`; `effective_at` | Populate number and effective date; never use generation time. |
| `[LESSEE NAME]`, lessee `[NAME]` | `customer_name` | Preserve the current Agreement legal-name meaning; show `business_name` separately. Business-party/entity wording still needs a decision. |
| Customer contact and address | `customer_email`, `customer_phone`, `billing_address`, `service_address`, `customer_type`, `business_name` | Populate explicitly labeled snapshot details. |
| `[LESSEE PHONE NUMBER]` | `customer_phone` | Populate. |
| `[LESSEE BUSINESS ADDRESS]`; `[its principal place of business/an address]` | No equivalent legal-address designation | A billing address is available but is not proof of a principal/business address. Leave unresolved; approve address meaning/alternative. |
| `[STATE OF ORGANIZATION]`, `[ENTITY TYPE]`, broken §14.1 placeholder | None | Leave unresolved; do not infer from “LLC” or Utah address. |
| `[LOCATION]` in §2 | `service_address` only for recorded `fulfillment_type = delivery` | Populate delivery address when applicable; pickup/location otherwise unresolved. |
| §3 delivery `[DATE]` | No distinct delivery-date field | Leave unresolved; do not assume rental start equals delivery. |
| §§8/9 commencement/expiration `[DATE]` | `rental_start_date`, `rental_end_date` | Populate stored summary dates; show each item’s own dates without calculating new summary dates. Per-unit/global term precedence still needs wording approval. |
| Equipment names, quantities, serials/VINs, dates, rates, days, amounts | `items[].equipmentName/quantity/serialNumber/startDate/endDate/dailyRate/billableDays/lineTotal/notes` | Populate a labeled transaction schedule alongside retained source Exhibit A. Never overwrite source catalog/reference tables. |
| Charges and actual deposit | `quote_amount`, `deposit_amount`, `delivery_fee`, `tax_amount`, `total_amount` | Populate recorded values alongside retained Exhibit C, including zero. No recomputation, new periods, fees, or default deposit. |
| Lessee printed signer name/title | `authorized_signer_name`, `authorized_signer_title` | Populate when recorded; no fallback from customer to authorized signer. Individual title is optional. |
| Lessee signing-date `[DATE]` | `signed_at` with recorded `acceptance_acknowledged` and accepted/signed status | Label explicitly as recorded acceptance of stored terms, not execution/acceptance of this proposed draft. Missing evidence stays unresolved. |
| Lessor `By`, date; lessee `By` | No lessor execution or signature image embedded in Agreement | Leave execution unresolved; printed Jason name/title are source designations, not evidence. `signed_by` is staff attribution, not Jason’s signature. |
| Schedule 1 customer/rental details | Same snapshot contact, number, dates, items, amounts | Populate as customer/rental context, explicitly not verified cardholder/card billing data. |
| Schedule 1 acknowledgment | `credit_card_authorization_terms`, acknowledgment flag/timestamp; recorded signer | Show the stored provider-safe terms and recorded state/timestamp separately. No acceptance of replacement wording is implied. |
| Schedule 1 `I`, cardholder name/printed name/signature/date/type | No verified cardholder/provider identification in Agreement | Leave unresolved. Do not equate customer/signer with cardholder or acknowledgment timestamp with a cardholder signature. Optional expiration/card billing ZIP/address fields may be omitted, with exact omissions reported; raw number/CVV remain excluded. |
| Exhibit D equipment / serial reference | All snapshot items | Populate unit references for every item; do not select an arbitrary first unit. |
| Exhibit D invoice number, actual checkout/check-in date/time, meters/fuel/condition/return charges, operational signatures and dates | None in Agreement | Keep clearly unrecorded. Rental dates/notes and Agreement acceptance are not inspection evidence. This remains operational work outside this task. |

All unresolved required contract fields are listed as review finalization blockers, not new application gates. No wording is silently rewritten to make an individual renter a business entity or to bypass missing data.
