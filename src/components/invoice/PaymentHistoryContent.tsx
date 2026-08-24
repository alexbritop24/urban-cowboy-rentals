import {
  formatDocumentCurrency,
  formatDocumentDateTime,
  type PaymentHistoryLoadState,
} from "../../utils/documentPresentation";

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
      <section className="document-section rounded-3xl border border-yellow-500/10 bg-black/25 p-6 text-[#b8a99a]">
        Loading payments...
      </section>
    );
  }

  return (
    <section className="document-section rounded-3xl border border-yellow-500/10 bg-black/25 p-6">
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f4b000]">
          Payment History
        </p>

        <h2 className="mt-2 text-2xl font-black text-[#fff7ed]">Payments</h2>
      </div>

      {state.status === "error" ? (
        <p className="text-red-300">{state.message}</p>
      ) : payments.length === 0 ? (
        <p className="text-[#b8a99a]">No payments have been recorded.</p>
      ) : (
        <div className="space-y-4">
          {payments.map((payment) => (
            <article
              key={payment.id}
              className="rounded-2xl border border-yellow-500/10 bg-black/20 p-4"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xl font-black text-[#fff7ed]">
                    {formatDocumentCurrency(payment.amount)}
                  </p>

                  <p className="mt-1 text-sm font-bold capitalize text-[#f4b000]">
                    {payment.payment_method.replaceAll("_", " ")}
                  </p>

                  {payment.reference_number && (
                    <p className="mt-2 text-sm text-[#b8a99a]">
                      Reference: {payment.reference_number}
                    </p>
                  )}

                  {payment.notes && (
                    <p className="mt-2 text-sm leading-6 text-[#b8a99a]">
                      {payment.notes}
                    </p>
                  )}
                </div>

                <time
                  dateTime={payment.received_at}
                  className="text-sm text-[#8f8577]"
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
