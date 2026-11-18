import type { RentalQuoteSnapshot } from '../domain/quotes/rentalQuoteMessage';
import { supabase } from '../lib/supabase';
export type QuoteStatus = 'draft' | 'sending' | 'sent' | 'delivered' | 'failed';
export interface QuoteDelivery {
  id: string; rental_request_id: string; snapshot: RentalQuoteSnapshot; amount: number; recipient_email: string;
  status: QuoteStatus; sent_by: string | null; created_by: string; created_at: string; sent_at: string | null;
  delivered_at: string | null; provider_message_id: string | null;
  error_details: string | null; error_code: string | null; retryable: boolean;
}
export async function getRentalQuoteHistory(requestId: string): Promise<QuoteDelivery[]> {
  const { data, error } = await supabase.from('rental_quote_deliveries')
    .select('id,rental_request_id,snapshot,amount,recipient_email,status,created_by,sent_by,created_at,sent_at,delivered_at,provider_message_id,error_details,error_code,retryable')
    .eq('rental_request_id', requestId).order('created_at', { ascending: false }).limit(20);
  if (error) throw new Error('Quote history is unavailable. Refresh before sending.');
  return data || [];
}
export async function sendRentalQuote(requestId: string, amount: number, recipient: string) {
  const { data, error } = await supabase.functions.invoke('rental-quotes', { body: { requestId, amount, recipient, confirmed: true } });
  if (error) {
    const response = 'context' in error ? error.context : null;
    const detail = response instanceof Response ? await response.json().catch(() => null) : null;
    throw new Error(detail?.error || 'Could not confirm delivery. Refresh the status before retrying.');
  }
  if (!data || typeof data.status !== 'string') throw new Error('Could not confirm delivery. Refresh before retrying.');
  return data as { id: string; status: QuoteStatus; retryable: boolean; error: string | null };
}
