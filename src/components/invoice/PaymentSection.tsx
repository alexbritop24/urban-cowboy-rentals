import { useState } from "react";

import {
  recordPayment,
  type PaymentMethod,
} from "../../services/paymentService";
import type { Invoice } from "../../types/invoice";

interface PaymentSectionProps {
  invoice: Invoice;
  onInvoiceUpdated: (invoice: Invoice) => void;
  onPaymentRecorded: () => void;
}

export default function PaymentSection({
  invoice,
  onInvoiceUpdated,
  onPaymentRecorded,
}: PaymentSectionProps) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const balance = Number(invoice.balance_due || 0);
  const canRecordPayment =
    invoice.status !== "draft" &&
    invoice.status !== "cancelled" &&
    balance > 0;

  const handleRecordPayment = async () => {
    const paymentAmount = Number(amount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      setMessage("Enter a valid payment amount.");
      return;
    }

    if (paymentAmount > balance) {
      setMessage(
        `Payment cannot exceed the remaining balance of $${balance.toFixed(2)}.`
      );
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      const result = await recordPayment({
        invoiceId: invoice.id,
        amount: paymentAmount,
        paymentMethod,
        referenceNumber,
        notes,
      });

      onInvoiceUpdated(result.invoice);
      onPaymentRecorded();

      setAmount("");
      setReferenceNumber("");
      setNotes("");
      setMessage("Payment recorded successfully.");
    } catch (error) {
      console.error("RECORD PAYMENT ERROR:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to record payment."
      );
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

        <p className="mt-2 text-sm text-[#b8a99a]">
          Remaining balance: ${balance.toFixed(2)}
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
            Amount
          </label>

          <input
            type="number"
            min="0.01"
            max={balance}
            step="0.01"
            value={amount}
            disabled={!canRecordPayment || isSaving}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            className="w-full rounded-2xl border border-yellow-500/10 bg-black/40 px-4 py-3 text-[#fff7ed] outline-none focus:border-yellow-500/40 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
            Payment Method
          </label>

          <select
            value={paymentMethod}
            disabled={!canRecordPayment || isSaving}
            onChange={(event) =>
              setPaymentMethod(event.target.value as PaymentMethod)
            }
            className="w-full rounded-2xl border border-yellow-500/10 bg-black/40 px-4 py-3 text-[#fff7ed] outline-none focus:border-yellow-500/40 disabled:cursor-not-allowed disabled:opacity-50"
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

        <div>
          <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
            Reference Number
          </label>

          <input
            type="text"
            value={referenceNumber}
            disabled={!canRecordPayment || isSaving}
            onChange={(event) => setReferenceNumber(event.target.value)}
            placeholder="Check, transaction, or receipt number"
            className="w-full rounded-2xl border border-yellow-500/10 bg-black/40 px-4 py-3 text-[#fff7ed] outline-none focus:border-yellow-500/40 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
            Notes
          </label>

          <input
            type="text"
            value={notes}
            disabled={!canRecordPayment || isSaving}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional payment notes"
            className="w-full rounded-2xl border border-yellow-500/10 bg-black/40 px-4 py-3 text-[#fff7ed] outline-none focus:border-yellow-500/40 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-bold text-[#b8a99a]">
          {message ||
            (!canRecordPayment
              ? balance <= 0
                ? "This invoice has been paid in full."
                : "Issue the invoice before recording payments."
              : "")}
        </p>

        <button
          type="button"
          onClick={handleRecordPayment}
          disabled={!canRecordPayment || isSaving}
          className="rounded-full bg-[#f4b000] px-6 py-4 text-sm font-black uppercase tracking-[0.1em] text-black transition hover:bg-[#f59e0b] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "Recording..." : "Record Payment"}
        </button>
      </div>
    </section>
  );
}