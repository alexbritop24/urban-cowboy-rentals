# Urban Cowboy Rentals Agreement Counsel Review Brief

**Status: COUNSEL REVIEW REQUIRED — NOT APPROVED FOR CUSTOMER USE**

This brief records business requirements and legal-review questions for a future revision of the Urban Cowboy Rentals Agreement. It is not legal advice, does not replace the current versioned Agreement clauses, and does not authorize a production legal-clause migration.

## Source Material

The reference draft is read-only:

`UCR_Equipment_Lease_Final_Draft (1) 3.docx`

The 16-page draft supplies useful business context, but it has not been approved by counsel. Its first-page address layout is broken, its Exhibit C rates conflict with the authoritative website catalog, and its Schedule 1 requests full payment-card data that the application must never collect or retain.

## Generated PDF Accessibility

The installed Release 1 PDF renderer supports document title, author, subject, keyword, and language metadata, and the Agreement and Invoice generators provide those values. It does not expose properly tagged-PDF output through its supported React API. Generated PDFs must not be described as tagged or fully assistive-technology accessible. The semantic browser Agreement and Invoice HTML is the supported assistive-technology alternative for Release 1 while tagged-PDF support remains a documented renderer limitation.

## Company Identity

- Urban Cowboy Rentals LLC
- 1032 E 1700 S
- Salt Lake City, Utah 84105
- 801-903-9380
- urbancowboyrentals@gmail.com

## Authoritative Commercial Requirements

### Pricing and equipment

Website/database catalog pricing is authoritative for new rentals. Agreement and Invoice items must use their immutable normalized snapshots. Counsel-approved wording must not copy or depend on the reference DOCX's static Exhibit C rental rates, and historical snapshots must never be rewritten from the current catalog.

### Deposits

Exhibit C amounts are suggested minimum deposits, not mandatory fixed amounts. Staff may require a higher or lower amount based on rental-specific risk. The amount recorded on the applicable Agreement or Invoice is the actual transaction deposit. A deposit does not limit renter liability, and no document or workflow may fabricate a deposit when none was recorded.

### Insurance

Every customer must provide property insurance and at least $1,000,000 in liability coverage. Workers' compensation is required only when legally applicable. Proof must be verified before Agreement finalization and final Approval. Counsel should align the legal wording with the existing exact-current-document verification workflow and define acceptable carriers, insured/loss-payee language, notice requirements, deductibles, duration, and verifier authority.

### Operator eligibility

The business requirements for counsel and insurer review are:

- Operators of equipment, tools, lifts, and trailers must be at least 18.
- Motorcycle operators must be at least 21.
- Motorcycle operators must possess a correct, unrestricted Utah motorcycle endorsement.
- Only operators authorized by the Agreement may operate rented equipment or vehicles.
- Every operator must possess all licenses, endorsements, training, and towing qualifications legally required for the applicable unit and use.

These requirements are approved business direction, but they must not be presented as final customer-facing legal language until attorney and insurer review is complete.

### Payment-card security

The application must never collect, display, transmit, log, snapshot, or store a full card number or CVV. Schedule 1's full card-number and CVV fields and its card-retention language must be replaced with provider-safe authorization wording. Permitted safe metadata is limited to existing provider data such as brand, last four digits, provider reference, acknowledgment state, and timestamps when those values actually exist. The current provider-safe credit-card authorization acknowledgment must remain in effect until approved replacement wording is versioned.

### Individual and business renters

The replacement Agreement must support both individual and business renters. Business-specific representations, signer authority, titles, and entity details should appear only when applicable; individual renters should not be forced into business-entity representations.

## Provisions Requiring Attorney Review

Counsel should review and supply final language for at least:

- late fees, extensions, default interest, collection costs, and chargeback consequences;
- indemnification, defense, limitation-of-liability, waiver, and risk-allocation provisions;
- property, liability, and legally applicable workers' compensation insurance requirements;
- equipment loss, recovery, repossession, impound, stipulated-loss, and inspection procedures;
- deposit collection, permitted deductions, accounting, timing, and return procedures;
- electronic consent, typed-name acceptance, signer authority, evidence retention, and signature sufficiency;
- motorcycle-specific age, licensing, endorsement, authorized-operator, safety, insurance, and assumption-of-risk provisions;
- Utah venue, governing law, notices, severability, assignment, and enforceability; and
- the interaction between the Agreement, Invoice, inspection forms, payment-provider authorization, and future amendments.

## Implementation Boundary

This branding work may improve presentation of the current stored clause snapshots, but it must not change their wording or legal status. Any approved replacement must be separately versioned, reviewed as a forward-only legal-clause change, tested against Agreement snapshot hashing and acceptance linkage, and approved before customer activation.

**COUNSEL REVIEW REQUIRED — NOT APPROVED FOR CUSTOMER USE**
