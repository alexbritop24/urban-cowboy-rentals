# Automated quote delivery

Status: feature branch only. Do not merge or deploy without Alex's approval. `vercel.json` disables automatic preview deployment for `codex/automated-quote-delivery` so pushing/opening the PR does not deploy the frontend. Other branches retain their existing deployment behavior. Confirmation and password recovery are a separate next task.

## Staff workflow

Save the quote amount, review the existing email preview, and choose **Send quote**. A separate confirmation displays the recipient and amount and requires the staff member to check both before **Confirm and send**. The quote is sent directly; no email application opens. **Copy quote** remains available even when email delivery is unavailable. Save/clear amount behavior is preserved.

The current quote shows Draft, Sending, Sent, Delivered, or Failed, with refresh and delivery history. Sent means the provider accepted it; Delivered means a cryptographically verified `email.delivered` webhook was recorded. Bounces, complaints, suppression, and provider delivery failures produce terminal Failed states. A corrected email/amount/context creates a new quote snapshot; an unchanged sent quote cannot be sent twice.

## Architecture and security

- `RentalQuoteDraft.tsx` uses `rentalQuoteService.ts` for staff-only history reads and the `rental-quotes` Edge Function. Both preview/copy and the server use `rentalQuoteMessage.ts`; email HTML escapes customer content.
- The existing application has Supabase Edge Functions and n8n notification hooks, but no reusable transactional email sender. This feature reuses the Supabase infrastructure and adds Resend, without depending on n8n. No provider keys are shipped to the browser.
- The Edge Function verifies the user's session using `auth.getUser()` and trusted `app_metadata` staff/admin roles. The preparation RPC independently checks staff privileges, locks the request, and verifies the confirmed email/amount against saved data. Untrusted user metadata cannot grant access.
- Migration `20261118000100_automated_rental_quotes.sql` creates immutable quote snapshots, a provider-event inbox, staff-only SELECT access, preparation RPC, and service-role-only claim/completion/event RPCs. Existing rental details, line prices, agreements, invoices, and customer records are not rewritten by the migration.
- Each quote records its amount, recipient, initiating staff ID, sending/retrying staff ID, timestamps, provider message ID, status, error code/details, and retry state. The frozen provider payload is server-only. Raw provider secrets/errors are never returned to the browser; delivery errors are deliberately sanitized.
- A unique request/snapshot fingerprint prevents duplicate quote creation across tabs or staff. A database lease prevents overlapping sends, and each attempt uses the same Resend `Idempotency-Key` and persisted payload. Failed attempts have a 30-second cooldown and a maximum of five attempts. A lost provider response remains uncertain and retryable with that same key. Retries are refused after 23 hours because Resend retains idempotency keys for 24 hours. No new key is silently created to bypass uncertainty; the owner must inspect the provider before any further action.
- Verified callbacks are durable/idempotent and can arrive before the send response is saved. Advisory locks and a provider-event inbox prevent callback/completion races. Terminal provider failures take precedence over delayed delivery events. The webhook verifies the original body, Svix ID, timestamp (five-minute tolerance), and HMAC using Web Crypto; tests include Svix's published signature vector and tamper/replay failures.
- Test mode is fail-closed: recipients must be listed in `QUOTE_TEST_RECIPIENTS`, including the stored payload on retries. There is no browser-controlled provider URL, sender, test override, body, staff identity, or delivery status.

## Required owner configuration

Use a Resend account controlled by the business/owner. The owner must supply:

| Secret | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Server-side sending key, preferably scoped to the verified sending domain. |
| `QUOTE_FROM_EMAIL` | Bare email address on a Resend-verified sending domain, for example `quotes@urbancowboyrentals.com`. Verify domain/DNS ownership and sender approval first. |
| `QUOTE_REPLY_TO_EMAIL` | Approved monitored inbox for customer replies. The existing public contact is `urbancowboyrentals@gmail.com`; confirm the owner wants replies there. |
| `QUOTE_DELIVERY_MODE` | Required: `test` during validation, `live` only after approval. Missing/unknown values disable sending. |
| `QUOTE_TEST_RECIPIENTS` | Comma-separated exact test addresses. Start with `delivered@resend.dev,bounced@resend.dev`. |
| `RESEND_WEBHOOK_SECRET` | Endpoint signing secret from the Resend webhook configuration (`whsec_...`). |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are supplied by the hosted Edge runtime. Do not put provider/service secrets in Vercel client variables, Git, chat, or screenshots. A placeholder server-only example is in `supabase/functions/.env.quotes.example`.

No usable Resend credentials were supplied or discovered in the inspected project configuration. Actual provider delivery testing and Deno-hosted execution remain pending credentials plus deployment approval; local server tests use simulated provider responses.

## Deployment plan — approval required

1. Review this PR and obtain approval for a staging deployment. Do not use production customer records as fixtures.
2. Apply only migration `20261118000100_automated_rental_quotes.sql` to staging and record its version in migration history through the established migration process. It depends on the existing rental-request/staff authorization foundation.
3. Copy the example to a secret file **outside the repository**, fill in the owner values, and set `QUOTE_DELIVERY_MODE=test`. Configure secrets for the staging project, then deploy both functions:

   ```sh
   supabase secrets set --env-file /secure/path/quote-secrets.env --project-ref cmqsvywbhswrycgxvbgy
   supabase functions deploy rental-quotes --project-ref cmqsvywbhswrycgxvbgy
   supabase functions deploy quote-events --project-ref cmqsvywbhswrycgxvbgy
   ```

   The checked-in config keeps JWT verification enabled for `rental-quotes`. `quote-events` disables Supabase JWT verification because it requires the independent provider signature instead. Never disable the sender's staff authorization.
4. Create the Resend webhook at `https://cmqsvywbhswrycgxvbgy.supabase.co/functions/v1/quote-events`, subscribing to `email.sent`, `email.delivered`, `email.bounced`, `email.failed`, `email.complained`, and `email.suppressed`. Set its signing secret in the staging secrets. The provider dashboard's endpoint URL and secret must correspond to this staging endpoint.
5. After approval, remove/adjust the branch-specific deployment block or trigger an approved manual preview, and deploy/review a frontend preview targeting staging. Use synthetic rental requests with the controlled Resend test recipients and confirm the amount/recipient before each send. Validate Sent → Delivered using `delivered@resend.dev`, Failed using `bounced@resend.dev`, double clicks/two tabs, invalid/nonstaff calls, stale amount/email, and provider/config failures. Verify one provider ID per unchanged quote and that Copy Quote still works. Send to an owner-controlled real test inbox only after that recipient is explicitly authorized.
6. After staging/provider tests pass, request **separate production approval**. Apply the migration first, configure approved production sender/reply-to secrets, deploy the functions and production-specific signed webhook, then deploy the frontend. Switch the production sender to `live` only as part of that approved release. Never point the staging webhook at production or share webhook signing secrets across environments.
7. If delivery must be stopped, remove `QUOTE_DELIVERY_MODE` or set an unsupported value to disable the sender. Preserve quote/event records for reconciliation; do not drop tables, delete history, or create fresh IDs to retry uncertain sends.

## Verification

- Automated persistence/server tests: `npm run test:quotes`; authorization, canonical idempotency, leases, frozen payloads, safe retry limits, early/replayed/out-of-order webhooks, HTML escaping, missing configuration, transient/permanent failures, test recipient restrictions, and signature verification.
- Application types: `npx tsc -p tsconfig.app.json`; Edge wrapper/shared types: `npm run check:functions` (TypeScript compatibility check, not a substitute for Deno-hosted validation).
- Full persistence/server regression suite: `node --test tests/persistence/*.test.mjs tests/server/quote-delivery.test.mjs`.
- Full repository lint was run. Seven preexisting errors remain in untouched `scripts/review-agreement/ReviewAgreementPdf.tsx`; all changed TypeScript files pass targeted lint.
- Build: TypeScript plus Vite production build and SEO generation. Existing large-bundle warnings remain.
- Local desktop/mobile browser checks use a simulated backend; they do not send emails. They cover edit/save, preview, confirmation gating, failure/retry, double-submit prevention, Sent/Delivered display, absence of mailto actions, and mobile width.
- Rollback-only hosted staging check:

  ```sh
  QUOTE_STAGING_DB_CHECK=1 node scripts/validate-quote-staging.mjs
  ```

  Set `SUPABASE_CLI` if the CLI is not on PATH. The script is pinned to validation project `cmqsvywbhswrycgxvbgy`, wraps the migration and SQL fixtures in a transaction, tests staff/customer/service-role boundaries and delivery transitions, and rolls everything back. It does not deploy functions, send emails, or retain test/customer changes.

## Provider references

- [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys) — 24-hour retention; requests must reuse an identical payload.
- [Resend signed webhooks](https://resend.com/docs/webhooks/verify-webhooks-requests) and [Svix manual verification](https://docs.svix.com/receiving/verifying-payloads/how-manual).
- [Resend controlled test recipients](https://resend.com/docs/dashboard/emails/send-test-emails).


## Results for this PR

- 57 persistence/server regression tests passed (including all 13 new quote tests).
- Application TypeScript, Edge compatibility TypeScript, changed-file ESLint, and the production build passed; domain-cycle check found zero cycles.
- Full-repository lint reports only the seven preexisting PDF review-script errors listed above.
- Rollback-only hosted staging checks passed. `quote_table_exists_after_rollback=false` confirmed the migration and fixtures were not retained.
- Local desktop/mobile quote flows passed against simulated HTTP responses. Visual review also checked that Delivered replaces pending-delivery copy instead of showing conflicting messages.
- No production changes, retained staging schema changes, deployed functions, provider API calls, or customer emails occurred. Actual Resend sends, hosted Edge execution, and provider-generated webhook callbacks require owner configuration and staging-deployment approval.
