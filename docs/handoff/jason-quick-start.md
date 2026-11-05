# Urban Cowboy Rentals — Jason's quick start

This guide follows the implemented Release 1 controls. The release walkthrough must verify them in the live configuration before handoff.

## Sign in and find requests

Open https://www.urbancowboyrentals.com/admin-login and use your own authorized staff/admin account. Complete account setup or password recovery yourself. Alex should transfer access through a secure invitation/recovery process, not a shared password in a document.

The Admin Dashboard shows rental requests, customer details, dates, status and internal operations. Search by customer, phone, email or equipment. Use the status, payment and priority filters, and Refresh for the current list. After cleanup, genuine requests remain visible. An empty dashboard is expected only if there are no genuine requests.

## Daily rental workflow

1. **Review the request.** Check the customer's contact information, requested units, dates and pickup/delivery arrangements. A request or confirmation message is not final rental Approval.
2. **Check availability.** Use the Approval checklist's initial availability action. Resolve overlapping bookings rather than overriding a conflict. For Release 1, the backend makes the final availability decision.
3. **Review documents.** Upload the customer's actual license and insurance through the private document controls. Review the exact current documents. The current license gate requires a verified Utah license; if that blocks a customer, stop and contact the designated reviewer rather than marking unsupported evidence verified.
4. **Create the Agreement.** Use Create Agreement. Review customer details, equipment, dates and recorded charges. Check the deposit before acceptance. The agreement populates from saved rental details; absent facts and signatures must not be invented.
5. **Get genuine acceptance.** Follow the agreed customer delivery/signature process. Record the actual authorized signer, title when applicable, Agreement acceptance and card-authorization acknowledgment using Record Acceptance. Do not check these boxes just to get past a gate. The current staff workflow is not a self-service customer signing portal.
6. **Finalize.** When the required documents and actual acceptance are complete, use Finalize Agreement. Finalization locks the saved version. Download Agreement PDF is the single agreement download. Later catalog or profile edits must not rewrite a signed Agreement.
7. **Open and issue the Invoice.** Use Create / Open Invoice. Check the saved line items, charges, total and balance; issue the Invoice before recording payment.
8. **Take and record payment.** Use the approved Square payment link or normal Square terminal process. After payment actually succeeds, record its amount, method and reference on the Invoice using Record Payment. Recording payment in this app does not itself charge a card. Do not enter full card numbers or CVV into notes or forms. Square last-four data is not automatically imported in Release 1.
9. **Approve the rental.** Return to the Approval checklist. Fix pending or failed prerequisites, then use its Approval action. With invoice_paid selected, a real recorded Invoice payment is required. Final availability is checked again; a conflict can still block Approval.
10. **Manage delivery and return.** Update the operational status as work progresses: preparing equipment, scheduled delivery, active rental, pickup scheduled, returned, inspection, completed. Complete the existing equipment-specific inspection paperwork separately. These status labels do not replace formal Approval or financial records.

## Important shortcuts and corrections

- Mark Quote Sent is an operational status update. Confirm the customer actually received the quote through the agreed channel.
- Mark Paid on the request is an operational shortcut. Use the Invoice's Record Payment action for the authoritative payment record and Approval requirement.
- If an Approved rental must change or be cancelled, use the established reversal/cancellation procedure. Do not delete its history or change status to force availability.
- A replaced license or insurance file may require a new review. A decision about an old file does not verify a new one.
- Never reuse another customer's signature or treat a generated name/date as proof of signing. Blank lessor/inspection lines require actual completion.
- If a button is disabled, read its checklist reason. Do not bypass the gate; ask Alex or the designated operator if the reason is unclear.

## A 30-minute walkthrough

- 0–5 minutes: sign in, dashboard totals, search, filters, and request details.
- 5–10 minutes: availability, private uploads, license/insurance review, checklist reasons.
- 10–20 minutes: populated Agreement, genuine acceptance, finalization and the single PDF; Invoice issue and payment recording.
- 20–25 minutes: final Approval, delivery/return statuses, a conflict, and the correction/reversal procedure.
- 25–30 minutes: Jason explains the workflow back, finds a request and PDF, and knows whom to contact.

Demonstrate with an isolated training/validation record outside production. Do not create another fake production rental or a real charge for training. If the validation site is unavailable, show the screens read-only and record which actions were not demonstrated.

## Handoff checklist

Jason and Alex should confirm: Jason can sign in; notifications reach the intended inbox; the agreed signature/delivery process is understood; insurance verification and document retention have named owners; account recovery and backup responsibility are recorded; current launch settings are verified; test records are hidden without deleting business history; and remaining issues have an owner.

Keep actual login credentials, customer documents, and payment information out of this guide. This pass delivers Release 1; customer accounts, Request Cart, automatic Square import and further automation are future scope.
