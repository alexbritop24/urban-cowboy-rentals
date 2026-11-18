# Pricing, customer history, and accounts

Implemented in PR #23 and deployed to production on November 18, 2026. See the deployment record below for verification results and remaining email checks.

## Jason's workflow

1. Open **Equipment and pricing** in the staff workspace. Change a duration price and choose **Publish prices**. Public equipment cards, equipment pricing tables, and booking price labels read the saved catalog. Concurrent edits fail with a reload instruction. Existing rental items, agreements, and invoices retain their snapshots. Duration tiers are displayed prices; this phase does not introduce automatic weekly-discount calculations.
2. Open **Customers**. Search by name, business, phone, or email. Expand a customer to see requests, completed-rental counts, dates, and links to individual requests. Records group by the exact normalized name, email, phone, customer type, and business name. Changes in those identifiers can produce separate contacts; this phase does not silently merge them.
3. Customers open **My account** (`/account`) to create an account, confirm their email, sign in, or request password recovery. Requests submitted while signed in appear in **My rentals**. Customers can download their finalized agreements and issued invoices through the existing snapshot PDF renderers. Drafts and staff records remain private.
4. Earlier guest/phone rentals require Jason to verify the customer and explicitly link their verified account from the customer record. Matching an email alone never claims historical rentals. Subsequent matching contact records inherit that explicit link. Guest booking remains available.

## Validation performed

- TypeScript application check and ESLint on changed application files and the hosted validation script passed.
- All 44 persistence tests passed. The new account test was rerun after extending it to cover authenticated multi-item creation; it passed.
- All 29 document presentation tests passed; domain dependency check found zero cycles.
- Vite production build passed. Existing large-bundle warnings remain; dynamic imports of already-loaded document services also produce informational warnings.
- Local browser checks used simulated API responses: mobile account creation/confirmation message, recovery request, sign-in, rental view, denial of staff UI to customer sessions, price publishing/public display, customer search/history/linking, and password update. These checks do not prove email delivery.
- Staging migration `20261117000200` was applied transactionally to `cmqsvywbhswrycgxvbgy` and recorded in migration history. All 19 preexisting requests received contact IDs; none were assigned account ownership by backfill.
- Hosted staging checks used existing synthetic users and two new synthetic requests: guest history remained unclaimed, signed-in request ownership was captured, another account could not read it, direct request/contact table reads remained inaccessible, staff-only pricing/linking enforced trusted roles, and explicit linking exposed only the intended history. A no-change price save verified the hosted write path. No emails or payments were sent.
- Staging public Auth settings report email enabled, sign-up enabled, and email confirmation required.

## Before production launch

1. Confirm Supabase Auth Site URL and allowed confirmation/recovery redirects for the production host: `/account` and `/account?mode=reset`. Add explicitly approved preview URLs when preview testing is needed.
2. Verify confirmation and password-recovery email delivery using an authorized test inbox. The application flows are tested; SMTP delivery and real callback redirects remain unverified.
3. Apply only `supabase/migrations/20261117000200_pricing_customers_and_accounts.sql` to production, record it in migration history, and verify counts, prices, role boundaries, and unchanged existing document snapshots. This migration must precede the frontend because public prices now come from `get_rental_rates`.
4. Deploy the frontend and smoke-test guest booking, signed-in booking, account recovery, one authorized historical-account link, staff pricing, and document access with two accounts. Do not expose the new customer features as launch-complete until those checks pass.

Square payment processing, automation delivery, and QuickBooks integration are outside this phase. Accounts do not send quotes or invoices automatically and do not collect card numbers.

## Repeat hosted validation

With the existing staging validation environment loaded, run:

```sh
node --env-file=/path/to/staging-validation.env scripts/validate-customer-accounts-hosted.mjs
```

The script requires the expected validation project, service key, existing synthetic-user tokens, and `RELEASE_VALIDATION_ALLOW_MUTATIONS=true`. It refreshes those synthetic sessions without sending email, creates two staging requests and leaves them for inspection. It marks them as test data when the staging schema supports that column; the current staging project lacks it, so the two fixtures remain visible there. No unrelated classification migration was applied. It writes evidence to `CUSTOMER_ACCOUNTS_EVIDENCE_PATH`, defaulting to `/private/tmp/ucr-accounts-hosted-evidence.json`. Never run against production.

## Production deployment, November 18, 2026

- PR #23 merged as `390809140b34311d683a9d85c6f4fd95e7270997`. Vercel production deployment `9yGpqGN2Q8wRbXCreMWSL9G9XQzC` reported success.
- Applied and recorded migration `20261117000200` in production. Transactional digest checks preserved all existing request details (excluding contact metadata/update timestamps), request items, agreements/items, and invoices/items. All 9 existing requests have contact IDs; none were automatically assigned account ownership. Existing 18 agreements and 2 invoices remained unchanged.
- Live desktop/mobile browser checks passed for the account page, noindex metadata, mobile sizing, the guest booking form, and staff login protection, with no JavaScript errors. Signed-in staff/account scenarios remain covered by the earlier staging/browser tests; no real customer history was linked during deployment.
- Live API verification exposed missed September Bobcat rate migrations: the production catalog still held August seed rates of $120/$275, while the published source catalog listed $280/$280. Migration `20261117000300` reconciles only those known legacy daily values and their displayed daily tiers. A focused regression test verifies repeatability, preservation of later custom prices, and unchanged saved item prices. The operational production wrapper also checks the old timestamps/missing migration history and verifies all rental/document records remain byte-for-byte unchanged.
- Production Auth configuration and actual confirmation/recovery email delivery remain unverified. The existing CLI credential was not available to the separate configuration lookup, and computer-use browser access timed out. Deployment does not establish that recovery email delivery has been tested.
