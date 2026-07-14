import { useState } from "react";

import {
  recordPayment,
  type PaymentMethod,
} from "../../services/paymentService";
import type { Invoice } from "../../types/invoice";

interface PaymentSectionProps {
  invoice: Invoice;
  onInvoiceUpdated: (invoice: Invoice) => void;
}

export default function PaymentSection({
  invoice,
  onInvoiceUpdated,
}: PaymentSectionProps) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const balance = Number(invoice.balance_due || 0);

  const handleRecordPayment = async () => {
    const paymentAmount = Number(amount);

    if (!paymentAmount || paymentAmount <= 0) {
      setMessage("Enter a valid payment amount.");
      return;
    }

    try {
      setIsSaving(true);
      setMessage("");

      const result = await recordPayment({
        invoiceId: invoice.id,
        amount: paymentAmount,
        paymentMethod,
        notes,
      });

      onInvoiceUpdated(result.invoice);

      setAmount("");
      setNotes("");

      setMessage("Payment recorded successfully.");
    } catch (error) {
      if (error instanceof Error) {
        setMessage(error.message);
      } else {
        setMessage("Unable to record payment.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-3xl border border-yellow-500/10 bg-black/25 p-6">
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f4b000]">
          Payments
        </p>

        <h2 className="mt-2 text-2xl font-black text-[#fff7ed]">
          Record Payment
        </h2>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
            Amount
          </label>

          <input
            type="number"
            min={0}
            max={balance}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-2xl border border-yellow-500/10 bg-black/40 px-4 py-3 text-[#fff7ed]"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
            Payment Method
          </label>

          <select
            value={paymentMethod}
            onChange={(e) =>
              setPaymentMethod(e.target.value as PaymentMethod)
            }
            className="w-full rounded-2xl border border-yellow-500/10 bg-black/40 px-4 py-3 text-[#fff7ed]"
          >
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="check">Check</option>
            <option value="ach">ACH</option>
            <option value="square">Square</option>
            <option value="stripe">Stripe</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
            Notes
          </label>

          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-2xl border border-yellow-500/10 bg-black/40 px-4 py-3 text-[#fff7ed]"
          />
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-[#b8a99a]">{message}</p>

        <button
          type="button"
          onClick={handleRecordPayment}
          disabled={isSaving || balance <= 0}
          className="rounded-full bg-[#f4b000] px-6 py-4 text-sm font-black uppercase tracking-[0.1em] text-black transition hover:bg-[#f59e0b] disabled:opacity-50"
        >
          {isSaving ? "Recording..." : "Record Payment"}
        </button>
      </div>
    </section>
  );
}