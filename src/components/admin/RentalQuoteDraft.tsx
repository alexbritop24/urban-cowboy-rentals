import { useCallback, useEffect, useRef, useState } from "react";

import { getRentalQuoteHistory, sendRentalQuote, type QuoteDelivery } from "../../services/rentalQuoteService";
import { rentalQuoteMessage, validQuoteEmail } from "../../domain/quotes/rentalQuoteMessage";
import { formatDocumentCurrency } from "../../utils/documentPresentation";

interface RentalQuoteDraftProps {
  requestId: string;
  customerName: string;
  customerEmail: string | null;
  equipment: string;
  startDate: string | null;
  endDate: string | null;
  fulfillment: string | null;
  savedAmount: number | null;
  onSave: (amount: number | null) => Promise<boolean>;
}

const actionClass = "rounded-lg border border-[#7c6238] px-3 py-2 text-sm font-semibold text-[#ffd98a] hover:bg-[#f4b000]/10 disabled:opacity-50";

const RentalQuoteDraft = ({
  requestId,
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
  const [sendError, setSendError] = useState("");

  const amountInput = editedAmount ?? savedAmount?.toFixed(2) ?? "";
  const amountText = amountInput.trim();
  const validAmount = !amountText || /^(?:\d{1,10}(?:\.\d{0,2})?|\.\d{1,2})$/.test(amountText);
  const amount = amountText ? Number(amountText) : null;
  const canPreview = savedAmount !== null && validAmount && amount === savedAmount && !saving;

  const recipient = customerEmail?.trim() ?? "";
  const snapshot = { templateVersion: 1, customerName, equipment, startDate, endDate, fulfillment, amount: savedAmount ?? 0, currency: "USD", recipient: recipient.toLowerCase() };
  const { subject, text: body } = rentalQuoteMessage(snapshot);
  const [history, setHistory] = useState<QuoteDelivery[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [confirmation, setConfirmation] = useState<{ amount: number; recipient: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const active = useRef(true);
  const refresh = useCallback(async () => {
    try {
      const records = await getRentalQuoteHistory(requestId);
      if (active.current) { setHistory(records); setHistoryError(""); setHistoryLoaded(true); }
    } catch (error) {
      if (active.current) setHistoryError(error instanceof Error ? error.message : "Could not refresh quote history.");
    }
  }, [requestId]);
  useEffect(() => {
    active.current = true;
    void getRentalQuoteHistory(requestId).then(records => {
      if (active.current) { setHistory(records); setHistoryError(""); setHistoryLoaded(true); }
    }).catch(() => { if (active.current) setHistoryError("Quote history is unavailable. Refresh before sending."); });
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 15000);
    window.addEventListener("focus", refresh);
    return () => { active.current = false; window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [requestId, refresh]);
  const currentDelivery = history.find(quote => quote.amount === savedAmount && quote.recipient_email.toLowerCase() === snapshot.recipient
    && quote.snapshot.customerName === customerName && quote.snapshot.equipment === equipment
    && quote.snapshot.startDate === startDate && quote.snapshot.endDate === endDate && quote.snapshot.fulfillment === fulfillment);
  const status = sending ? "sending" : currentDelivery?.status ?? "draft";
  const alreadySent = currentDelivery?.status === "sent" || currentDelivery?.status === "delivered";
  const canSend = canPreview && validQuoteEmail(recipient) && historyLoaded && !historyError && !sending && !alreadySent
    && !(currentDelivery?.status === "failed" && !currentDelivery.retryable);
  const send = async () => {
    if (sendingRef.current || !confirmed || !canSend || confirmation?.amount !== savedAmount || confirmation.recipient !== recipient) return;
    sendingRef.current = true; setSending(true); setError(""); setSendError(""); setMessage("");
    try {
      await sendRentalQuote(requestId, confirmation.amount, confirmation.recipient);
      setConfirmation(null); setConfirmed(false);
    } catch (error) { setSendError(error instanceof Error ? error.message : "Could not confirm quote delivery."); }
    finally { await refresh(); if (active.current) setSending(false); sendingRef.current = false; }
  };

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
      <p className="mt-1 text-sm text-[#d3c6b8]">Save an amount, review the quote, confirm the recipient and amount, then send it directly.</p>

      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!saving && !sending && (!validAmount || amount !== savedAmount)) void saveAmount();
        }}
      >
        <label className="block text-sm font-semibold text-[#fff7ed]">
          Quote amount (USD)
          <input
            inputMode="decimal"
            value={amountInput}
            onChange={(event) => {
              setEditedAmount(event.target.value);
              setSendError("");
              setError("");
              setMessage("");
            }}
            disabled={saving || sending}
            placeholder="0.00"
            className="mt-1 block w-full max-w-48 rounded-lg border border-[#786655] bg-[#14120f] px-3 py-2 font-normal text-[#fff7ed]"
          />
        </label>
        <button type="submit" disabled={saving || sending || (validAmount && amount === savedAmount)} className={actionClass}>
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
            <button type="button" className="rounded-lg bg-[#f4b000] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50" disabled={!canSend} onClick={() => { if (savedAmount !== null) { setConfirmation({ amount: savedAmount, recipient }); setConfirmed(false); setError(""); } }}>{sending ? "Sending…" : alreadySent ? "Already sent" : currentDelivery?.status === "failed" || currentDelivery?.status === "sending" ? "Retry safely" : "Send quote"}</button>
          </div>
          {!validQuoteEmail(recipient) && <p className="mt-2 text-sm text-red-200">A valid customer email is required before sending. You can still copy the quote.</p>}
          {confirmation && confirmation.amount === savedAmount && confirmation.recipient === recipient && canPreview && <form className="mt-4 space-y-3 rounded-lg border border-[#a6802a] p-4 text-sm text-[#fff7ed]" onSubmit={event => { event.preventDefault(); void send(); }}>
            <h4 className="font-bold">Confirm quote delivery</h4>
            <p className="break-all">To: {confirmation.recipient}</p><p>Amount: {formatDocumentCurrency(confirmation.amount)} USD</p>
            <label className="flex items-start gap-2"><input type="checkbox" required checked={confirmed} disabled={sending} onChange={event => setConfirmed(event.target.checked)} className="mt-1" />I checked the recipient and quoted amount.</label>
            <div className="flex flex-wrap gap-2"><button type="submit" disabled={!confirmed || !canSend} className={actionClass}>{sending ? "Sending…" : "Confirm and send"}</button><button type="button" disabled={sending} className={actionClass} onClick={() => setConfirmation(null)}>Cancel</button></div>
          </form>}
        </>
      )}
      <div className="mt-4 text-sm text-[#d3c6b8]" aria-live="polite"><p className="font-semibold capitalize">Quote status: {status}</p>
        {status === "sent" && <p className="mt-2">Quote sent. Delivery confirmation is pending.</p>}
        {status === "delivered" && <p className="mt-2">Delivery confirmed by the email provider.</p>}
        {status === "sending" && <p className="mt-2">Sending is in progress. Refresh the status before retrying.</p>}
        <button type="button" className="mt-2 underline" onClick={() => void refresh()}>Refresh delivery status</button>
        {currentDelivery?.error_details && <p className="mt-2 text-red-200">{currentDelivery.error_details}</p>}
        {history.length > 0 && <details className="mt-3"><summary className="cursor-pointer">Delivery history</summary><ul className="mt-2 space-y-2">{history.map(quote => <li key={quote.id} className="break-words border-t border-[#514337] pt-2"><span className="capitalize">{quote.status}</span> · {quote.recipient_email} · {formatDocumentCurrency(quote.amount)}<br />{new Date(quote.sent_at || quote.created_at).toLocaleString()}{quote.error_details && <p>{quote.error_details}</p>}</li>)}</ul></details>}
      </div>
      {historyError && <p role="alert" className="mt-3 text-sm text-red-200">{historyError} Sending is disabled until history is available. You can still copy the quote.</p>}
      {sendError && status !== "sent" && status !== "delivered" && <p role="alert" className="mt-3 text-sm text-red-200">{sendError}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-200">{error}</p>}
      {message && <p role="status" className="mt-3 text-sm text-[#d3c6b8]">{message}</p>}
    </section>
  );
};

export default RentalQuoteDraft;
