import { createClient } from 'npm:@supabase/supabase-js@2';
import { createQuoteSendHandler, type QuoteRecord } from '../_shared/quoteDelivery.ts';
interface Runtime { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void }
const runtime = (globalThis as typeof globalThis & { Deno: Runtime }).Deno;
runtime.serve(async request => {
  try {
    const url = runtime.env.get('SUPABASE_URL')!;
    const options = { auth: { persistSession: false, autoRefreshToken: false } };
    const caller = createClient(url, runtime.env.get('SUPABASE_ANON_KEY')!, { ...options, global: { headers: { Authorization: request.headers.get('Authorization') || '' } } });
    const server = createClient(url, runtime.env.get('SUPABASE_SERVICE_ROLE_KEY')!, options);
    const rpc = async <T>(client: typeof server, name: string, args: Record<string, unknown>): Promise<T> => {
      const { data, error } = await client.rpc(name, args);
      if (error) throw new Error(error.message);
      return data as T;
    };
    let staffId: string | null = null;
    return await createQuoteSendHandler({
      env: name => runtime.env.get(name), fetch,
      authorize: async () => {
        const { data, error } = await caller.auth.getUser();
        const role = data.user?.app_metadata?.role ?? data.user?.app_metadata?.app_role;
        staffId = data.user?.id ?? null;
        return !error && !!data.user && (role === 'staff' || role === 'admin');
      },
      prepare: (requestId, amount, recipient) => rpc<QuoteRecord>(caller, 'prepare_rental_quote', { target_request_id: requestId, confirmed_amount: amount, confirmed_recipient: recipient }),
      claim: (id, payload) => rpc(server, 'claim_rental_quote', { quote_id: id, proposed_payload: payload, sender_id: staffId }),
      finish: (id, token, result) => rpc(server, 'finish_rental_quote', { quote_id: id, claim_token: token, message_id: result.messageId, failure_code: result.code, failure_details: result.detail, can_retry: result.retryable }),
    })(request);
  } catch {
    return new Response(JSON.stringify({ error: 'Quote delivery is unavailable. Contact the site owner.' }), { status: 503, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }
});
