import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyQuoteWebhook } from '../_shared/quoteDelivery.ts';
interface Runtime { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void }
const runtime = (globalThis as typeof globalThis & { Deno: Runtime }).Deno;
const kinds = ['email.sent', 'email.delivered', 'email.bounced', 'email.failed', 'email.complained', 'email.suppressed'];
runtime.serve(async request => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (Number(request.headers.get('content-length')) > 65536) return new Response('Too large', { status: 413 });
  const secret = runtime.env.get('RESEND_WEBHOOK_SECRET');
  if (!secret) return new Response('Webhook is not configured', { status: 503 });
  let verified;
  try { verified = await verifyQuoteWebhook(request, secret); }
  catch { return new Response('Invalid webhook', { status: 400 }); }
  const { id, event } = verified;
  if (!event || !kinds.includes(event.type)) return new Response('Ignored', { status: 200 });
  if (typeof event.data?.email_id !== 'string' || !event.data.email_id || event.data.email_id.length > 200 || typeof event.created_at !== 'string' || !Number.isFinite(Date.parse(event.created_at))) return new Response('Invalid event', { status: 400 });
  try {
    const server = createClient(runtime.env.get('SUPABASE_URL')!, runtime.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await server.rpc('record_rental_quote_event', { event_key: id, message_id: event.data.email_id, event_kind: event.type, event_time: event.created_at });
    if (error) throw error;
    return new Response('Recorded', { status: 200 });
  } catch { return new Response('Retry event later', { status: 503 }); }
});
