import { rentalQuoteMessage, validQuoteEmail, type RentalQuoteSnapshot } from '../../../src/domain/quotes/rentalQuoteMessage.ts';

export interface QuoteRecord {
  id: string; status: string; recipient_email: string; amount: number;
  snapshot: RentalQuoteSnapshot; retryable: boolean; error_details: string | null;
  attempt_token: string; email_payload: Record<string, unknown>;
}
export interface QuoteDependencies {
  authorize(token: string): Promise<boolean>;
  prepare(requestId: string, amount: number, recipient: string): Promise<QuoteRecord>;
  claim(id: string, payload: Record<string, unknown>): Promise<{ acquired: boolean; quote: QuoteRecord }>;
  finish(id: string, token: string, result: { messageId: string | null; code: string | null; detail: string | null; retryable: boolean }): Promise<QuoteRecord>;
  env(name: string): string | undefined;
  fetch: typeof fetch;
}
export const quoteCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...quoteCors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const publicResult = (quote: QuoteRecord) => ({ id: quote.id, status: quote.status, retryable: quote.retryable, error: quote.error_details });
export const createQuoteSendHandler = (deps: QuoteDependencies) => async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: quoteCors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const token = request.headers.get('Authorization') || '';
  try {
    if (!token.startsWith('Bearer ') || !(await deps.authorize(token))) return json({ error: 'Sign in with a staff account to send quotes.' }, 403);
    if (Number(request.headers.get('content-length')) > 4096) return json({ error: 'Quote request is too large.' }, 400);
    const body = await request.text();
    if (body.length > 4096) return json({ error: 'Quote request is too large.' }, 400);
    let input: Record<string, unknown>;
    try { input = JSON.parse(body); } catch { return json({ error: 'Invalid quote request.' }, 400); }
    if (!input || typeof input !== 'object' || input.confirmed !== true || typeof input.requestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.requestId)
      || typeof input.amount !== 'number' || !Number.isFinite(input.amount) || input.amount < 0 || input.amount > 9999999999.99
      || Math.abs(input.amount * 100 - Math.round(input.amount * 100)) > 0.0001
      || typeof input.recipient !== 'string' || !validQuoteEmail(input.recipient.trim())) return json({ error: 'Confirm a valid customer email and saved quote amount.' }, 400);
    const apiKey = deps.env('RESEND_API_KEY');
    const from = deps.env('QUOTE_FROM_EMAIL');
    const replyTo = deps.env('QUOTE_REPLY_TO_EMAIL');
    const mode = deps.env('QUOTE_DELIVERY_MODE');
    if (!apiKey || !from || !validQuoteEmail(from) || !replyTo || !validQuoteEmail(replyTo) || !['test', 'live'].includes(mode || '')) {
      return json({ error: 'Quote email delivery is not configured. Contact the site owner; the preview and Copy Quote remain available.' }, 503);
    }
    const recipient = input.recipient.trim().toLowerCase();
    const allowed = (deps.env('QUOTE_TEST_RECIPIENTS') || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
    if (mode === 'test' && !allowed.includes(recipient)) return json({ error: 'Test mode only allows configured test recipients.' }, 403);
    let prepared: QuoteRecord;
    try { prepared = await deps.prepare(input.requestId, input.amount, recipient); }
    catch (error) { return json({ error: error instanceof Error ? error.message : 'The saved quote changed. Reload and confirm it again.' }, 409); }
    const message = rentalQuoteMessage(prepared.snapshot);
    const payload = { from: `Urban Cowboy Rentals <${from}>`, to: [prepared.recipient_email], reply_to: replyTo, ...message };
    const claim = await deps.claim(prepared.id, payload);
    if (!claim.acquired) return json(publicResult(claim.quote), claim.quote.status === 'sending' ? 202 : 200);
    const quote = claim.quote;
    // Check the persisted payload too: a test retry must never target a real
    // recipient even if configuration or a previous live deployment changed.
    const recipients = quote.email_payload.to;
    if (mode === 'test' && (!Array.isArray(recipients) || recipients.some(value => typeof value !== 'string' || !allowed.includes(value.toLowerCase())))) {
      const failed = await deps.finish(quote.id, quote.attempt_token, { messageId: null, code: 'test_recipient_blocked', detail: 'The saved recipient is not allowed in test mode.', retryable: false });
      return json(publicResult(failed));
    }
    let outcome: { messageId: string | null; code: string | null; detail: string | null; retryable: boolean };
    try {
      const response = await deps.fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `rental-quote/${quote.id}` },
        body: JSON.stringify(quote.email_payload), signal: AbortSignal.timeout(15_000),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && typeof data.id === 'string' && data.id.length > 0 && data.id.length <= 200) {
        outcome = { messageId: data.id, code: null, detail: null, retryable: false };
      } else {
        const retryable = response.status === 429 || response.status === 408 || response.status >= 500 || (response.status === 409 && data.name === 'concurrent_idempotent_requests') || response.ok;
        outcome = { messageId: null, code: `provider_${response.status}`, detail: retryable ? 'The provider response is unconfirmed. Wait 30 seconds, then retry safely.' : 'The provider rejected the quote. Ask the site owner to check the sender configuration or recipient in Resend.', retryable };
      }
    } catch {
      outcome = { messageId: null, code: 'provider_unconfirmed', detail: 'The provider response is unconfirmed. Wait 30 seconds, then retry safely.', retryable: true };
    }
    // A persistence failure after provider acceptance must not be rewritten as
    // an ordinary send failure. The lease and same key allow safe recovery.
    const finished = await deps.finish(quote.id, quote.attempt_token, outcome);
    return json(publicResult(finished));
  } catch {
    return json({ error: 'Could not confirm quote delivery. Refresh its status before retrying; retries reuse the same delivery record.' }, 503);
  }
};

/** Svix's documented HMAC protocol, verified with Web Crypto (no string comparison). */
export async function verifyQuoteWebhook(request: Request, secret: string, now = Date.now()) {
  const id = request.headers.get('svix-id') || '';
  const timestamp = request.headers.get('svix-timestamp') || '';
  if (!secret.startsWith('whsec_') || !id || id.length > 200 || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) throw new Error('Invalid webhook');
  const body = await request.text();
  if (body.length > 65536) throw new Error('Invalid webhook');
  const bytes = (value: string) => Uint8Array.from(atob(value), character => character.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', bytes(secret.slice(6)), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const content = new TextEncoder().encode(`${id}.${timestamp}.${body}`);
  let verified = false;
  for (const value of (request.headers.get('svix-signature') || '').split(' ').slice(0, 10)) {
    const [version, signature] = value.split(',');
    if (version !== 'v1' || !signature) continue;
    try { if (await crypto.subtle.verify('HMAC', key, bytes(signature), content)) verified = true; } catch { /* Reject malformed signatures. */ }
  }
  if (!verified) throw new Error('Invalid webhook');
  return { id, event: JSON.parse(body) };
}
