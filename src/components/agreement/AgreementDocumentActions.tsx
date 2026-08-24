import type { RentalAgreement } from "../../types/agreement";
import { getAgreementPrintReadiness } from "../../utils/documentPresentation";

interface AgreementDocumentActionsProps {
  agreement: RentalAgreement;
  documentPrerequisitesSatisfied: boolean;
  isCreatingInvoice: boolean;
  isFinalizing: boolean;
  isGeneratingPdf: boolean;
  isSaving: boolean;
  isSavingAcceptance: boolean;
  notice: string;
  onCreateInvoice: () => void;
  onDownloadPdf: () => void;
  onFinalize: () => void;
  onPrint: () => void;
}

export default function AgreementDocumentActions({
  agreement,
  documentPrerequisitesSatisfied,
  isCreatingInvoice,
  isFinalizing,
  isGeneratingPdf,
  isSaving,
  isSavingAcceptance,
  notice,
  onCreateInvoice,
  onDownloadPdf,
  onFinalize,
  onPrint,
}: AgreementDocumentActionsProps) {
  const isFinalized = Boolean(agreement.locked_at);
  const printReadiness = getAgreementPrintReadiness(
    agreement.snapshot_availability
  );

  return (
    <section className="document-no-print rounded-3xl border border-yellow-500/10 bg-black/25 p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f4b000]">
            Agreement Status
          </p>
          <p className="mt-2 text-sm text-[#b8a99a]">
            {isFinalized
              ? "The Agreement snapshot is locked. The existing Invoice workflow is available."
              : "Record acceptance evidence, then finalize the Agreement."}
          </p>
          {notice && (
            <p className="mt-2 text-sm font-bold text-[#fff7ed]">{notice}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onFinalize}
          disabled={
            isFinalized ||
            !printReadiness.enabled ||
            !documentPrerequisitesSatisfied ||
            isFinalizing ||
            isSaving ||
            isSavingAcceptance
          }
          className="rounded-full bg-[#f4b000] px-6 py-4 text-sm font-black uppercase tracking-[0.1em] text-black transition hover:bg-[#f59e0b] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isFinalized
            ? "Agreement Finalized"
            : isFinalizing
              ? "Finalizing..."
              : "Finalize Agreement"}
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t border-yellow-500/10 pt-6 sm:flex-row sm:flex-wrap sm:justify-end">
        <button
          type="button"
          onClick={onCreateInvoice}
          disabled={!isFinalized || isCreatingInvoice}
          className="rounded-full bg-green-500 px-6 py-4 text-sm font-black uppercase tracking-[0.08em] text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isCreatingInvoice ? "Opening Invoice..." : "Create / Open Invoice"}
        </button>
        <button
          type="button"
          onClick={onPrint}
          disabled={!printReadiness.enabled}
          aria-describedby={
            printReadiness.enabled ? undefined : "agreement-print-unavailable"
          }
          className="rounded-full border border-[#fff7ed]/30 px-6 py-4 text-sm font-black uppercase tracking-[0.08em] text-[#fff7ed] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Print Agreement
        </button>
        <button
          type="button"
          onClick={onDownloadPdf}
          disabled={isGeneratingPdf || !printReadiness.enabled}
          className="rounded-full border border-yellow-500 px-6 py-4 text-sm font-black uppercase tracking-[0.08em] text-[#f4b000] transition hover:bg-yellow-500/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isGeneratingPdf ? "Generating PDF..." : "Download Agreement PDF"}
        </button>
      </div>
      {!printReadiness.enabled && (
        <p
          id="agreement-print-unavailable"
          className="mt-4 text-sm font-bold text-amber-200"
        >
          {printReadiness.message}
        </p>
      )}
    </section>
  );
}
