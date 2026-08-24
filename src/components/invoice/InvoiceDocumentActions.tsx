import type { Invoice } from "../../types/invoice";
import {
  getInvoicePrintReadiness,
  type PaymentHistoryLoadState,
} from "../../utils/documentPresentation";

interface InvoiceDocumentActionsProps {
  invoice: Invoice;
  isIssuing: boolean;
  notice: string;
  onDownloadPdf: () => void;
  onIssue: () => void;
  onPrint: () => void;
  paymentHistoryState: PaymentHistoryLoadState;
}

export default function InvoiceDocumentActions({
  invoice,
  isIssuing,
  notice,
  onDownloadPdf,
  onIssue,
  onPrint,
  paymentHistoryState,
}: InvoiceDocumentActionsProps) {
  const isDraft = invoice.status === "draft";
  const printReadiness = getInvoicePrintReadiness(paymentHistoryState);

  return (
    <section className="document-no-print flex flex-col gap-4 rounded-3xl border border-yellow-500/10 bg-black/25 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f4b000]">
          Invoice Status
        </p>

        <p className="mt-2 text-sm text-[#b8a99a]">
          {isDraft
            ? "Review the charges, then issue the invoice to lock it."
            : invoice.issued_at
              ? `Issued on ${new Date(invoice.issued_at).toLocaleString()}`
              : "This invoice has been issued."}
        </p>

        {notice && (
          <p className="mt-2 text-sm font-bold text-[#fff7ed]">{notice}</p>
        )}
        <p
          id="invoice-print-readiness"
          className={`mt-2 text-sm font-bold ${
            printReadiness.enabled ? "text-[#b8a99a]" : "text-amber-200"
          }`}
        >
          {printReadiness.message}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onIssue}
          disabled={!isDraft || isIssuing}
          className="rounded-full bg-[#f4b000] px-6 py-4 text-sm font-black uppercase tracking-[0.1em] text-black transition hover:bg-[#f59e0b] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {!isDraft
            ? "Invoice Issued"
            : isIssuing
              ? "Issuing..."
              : "Issue Invoice"}
        </button>

        <button
          type="button"
          onClick={onDownloadPdf}
          className="rounded-full border border-yellow-500 px-6 py-4 text-sm font-black uppercase tracking-[0.1em] text-[#f4b000] transition hover:bg-yellow-500/10"
        >
          Download Invoice PDF
        </button>

        <button
          type="button"
          onClick={onPrint}
          disabled={!printReadiness.enabled}
          aria-describedby="invoice-print-readiness"
          className="rounded-full border border-[#fff7ed]/30 px-6 py-4 text-sm font-black uppercase tracking-[0.1em] text-[#fff7ed] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Print Invoice
        </button>
      </div>
    </section>
  );
}
