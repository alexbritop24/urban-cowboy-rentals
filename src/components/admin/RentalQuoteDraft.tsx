import { useState } from "react";

import { formatDocumentCurrency, formatDocumentDate } from "../../utils/documentPresentation";

interface RentalQuoteDraftProps {
  customerName: string;
  customerEmail: string | null;
  equipment: string;
  startDate: string | null;
  endDate: string | null;
  fulfillment: string | null;
  savedAmount: number | null;
  onSave: (amount: number | null) => Promise<boolean>;
}

const emailPattern = /^[^\s@,;?&#]+@[^\s@,;?&#]+$/;
const actionClass = "rounded-lg border border-[#7c6238] px-3 py-2 text-sm font-semibold text-[#ffd98a] hover:bg-[#f4b000]/10 disabled:opacity-50";

const RentalQuoteDraft = ({
  customerName,
  customerEmail,
  equipment,
  startDate,
  endDate,
  fulfillment,
  savedAmount,
  onSave,
}: RentalQuoteDraftProps) => {
  const [editedAmount, setEditedAmount] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const amountInput = editedAmount ?? savedAmount?.toFixed(2) ?? "";
  const amountText = amountInput.trim();
  const validAmount = !amountText || /^(?:\d{1,10}(?:\.\d{0,2})?|\.\d{1,2})$/.test(amountText);
  const amount = amountText ? Number(amountText) : null;
  const canPreview = savedAmount !== null && validAmount && amount === savedAmount && !saving;

  const recipient = customerEmail?.trim() ?? "";
  const subject = `Urban Cowboy Rentals quote for ${equipment.replace(/\s+/g, " ").trim()}`;
  const body = savedAmount === null ? "" : [
    `Hi ${customerName},`,
    "",
    "Thanks for your rental request. Here’s your quote from Urban Cowboy Rentals.",
    "",
    `Equipment: ${equipment}`,
    `Rental dates: ${formatDocumentDate(startDate, "Start to be confirmed")} to ${formatDocumentDate(endDate, "Return to be confirmed")}`,
    `Pickup or delivery: ${fulfillment || "To be confirmed"}`,
    `Quoted amount: ${formatDocumentCurrency(savedAmount)} USD`,
    "",
    "Reply with any questions or to discuss next steps. Your rental is subject to confirmation.",
    "",
    "Urban Cowboy Rentals",
  ].join("\n");
  const emailDraft = emailPattern.test(recipient)
    ? `mailto:${encodeURIComponent(recipient).replace("%40", "@")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : null;

  const saveAmount = async () => {
    setMessage("");
    setError("");
    if (!validAmount) {
      setError("Enter a dollar amount with up to two decimal places.");
      return;
    }

    setSaving(true);
    try {
      if (!(await onSave(amount))) {
        setError("Could not save the quote amount. Try again.");
        return;
      }
      setEditedAmount(null);
      setMessage(amount === null ? "Quote amount cleared." : "Quote amount saved.");
    } catch {
      setError("Could not save the quote amount. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const copyQuote = async () => {
    setError("");
    setMessage("");
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setMessage("Quote copied.");
    } catch {
      setError("Could not copy automatically. Select and copy the text from the preview.");
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-[#514337] bg-[#1c1915] p-4 sm:p-5">
      <h3 className="text-lg font-bold text-[#fff7ed]">Prepare a quote</h3>
      <p className="mt-1 text-sm text-[#d3c6b8]">Save an amount, review the quote, then send it from your email app.</p>

      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!saving && (!validAmount || amount !== savedAmount)) void saveAmount();
        }}
      >
        <label className="block text-sm font-semibold text-[#fff7ed]">
          Quote amount (USD)
          <input
            inputMode="decimal"
            value={amountInput}
            onChange={(event) => {
              setEditedAmount(event.target.value);
              setError("");
              setMessage("");
            }}
            disabled={saving}
            placeholder="0.00"
            className="mt-1 block w-full max-w-48 rounded-lg border border-[#786655] bg-[#14120f] px-3 py-2 font-normal text-[#fff7ed]"
          />
        </label>
        <button type="submit" disabled={saving || (validAmount && amount === savedAmount)} className={actionClass}>
          {saving ? "Saving…" : "Save amount"}
        </button>
      </form>

      {canPreview && (
        <>
          <details className="mt-4 rounded-lg border border-[#514337] p-3 text-sm text-[#fff7ed]">
            <summary className="cursor-pointer font-semibold">Preview email</summary>
            <p className="mt-3 break-words text-[#d3c6b8]">To {recipient || "No email on file"}</p>
            <p className="mt-1 break-words font-semibold">{subject}</p>
            <p className="mt-3 whitespace-pre-wrap break-words text-[#d3c6b8]">{body}</p>
          </details>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={actionClass} onClick={() => void copyQuote()}>Copy quote</button>
            {emailDraft && <a className={actionClass} href={emailDraft}>Open email draft</a>}
          </div>
          {!emailDraft && <p className="mt-2 text-sm text-[#d3c6b8]">Add the recipient in your email app when you use the copied quote.</p>}
        </>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-red-200">{error}</p>}
      {message && <p role="status" className="mt-3 text-sm text-[#d3c6b8]">{message}</p>}
    </section>
  );
};

export default RentalQuoteDraft;
