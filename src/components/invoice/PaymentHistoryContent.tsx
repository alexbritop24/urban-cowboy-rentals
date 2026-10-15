import {
  formatDocumentCurrency,
  formatDocumentDateTime,
  type PaymentHistoryLoadState,
} from "../../utils/documentPresentation";
import { sanitizeInvoicePdfText } from "../agreement/pdf/sanitizeInvoicePdfText";

export interface PaymentHistoryEntry {
  id: string;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  received_at: string;
}

interface PaymentHistoryContentProps {
  payments: readonly PaymentHistoryEntry[];
  state: PaymentHistoryLoadState;
}

export default function PaymentHistoryContent({
  payments,
  state,
}: PaymentHistoryContentProps) {
  if (state.status === "loading") {
    return (
      <section className="document-section border-t border-[#d8d0c6] pt-6 text-[#5f574f]">
        Loading payments...
      </section>
    );
  }

  return (
    <section className="document-section border-t border-[#d8d0c6] pt-6">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#76572f]">
          Payment History
        </p>

        <h2 className="mt-1 font-serif text-xl font-bold text-[#211d18]">Recorded Payments</h2>
      </div>

      {state.status === "error" ? (
        <p className="text-red-700">{state.message}</p>
      ) : payments.length === 0 ? (
        <p className="text-[#5f574f]">No payments have been recorded.</p>
      ) : (
        <div className="space-y-4">
          {payments.map((payment) => (
            <article
              key={payment.id}
              className="border-b border-[#e4ddd4] pb-4"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-lg font-black text-[#211d18]">
                    {formatDocumentCurrency(payment.amount)}
                  </p>

                  <p className="mt-1 text-sm font-bold capitalize text-[#76572f]">
                    {payment.payment_method.replaceAll("_", " ")}
                  </p>

                  {payment.reference_number && (
                    <p className="mt-2 text-sm text-[#5f574f]">
                      Reference: {sanitizeInvoicePdfText(payment.reference_number)}
                    </p>
                  )}

                  {payment.notes && (
                    <p className="mt-2 text-sm leading-6 text-[#5f574f]">
                      {sanitizeInvoicePdfText(payment.notes)}
                    </p>
                  )}
                </div>

                <time
                  dateTime={payment.received_at}
                  className="text-sm text-[#6f665c]"
                >
                  {formatDocumentDateTime(payment.received_at)}
                </time>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
