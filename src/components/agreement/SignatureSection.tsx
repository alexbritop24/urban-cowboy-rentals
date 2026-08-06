import type { RentalAgreement } from "../../types/agreement";

interface SignatureSectionProps {
  agreement: RentalAgreement;
  signerName: string;
  signerTitle: string;
  agreementAccepted: boolean;
  cardAuthorizationAcknowledged: boolean;
  isSaving: boolean;
  onSignerNameChange: (value: string) => void;
  onSignerTitleChange: (value: string) => void;
  onAgreementAcceptedChange: (value: boolean) => void;
  onCardAuthorizationChange: (value: boolean) => void;
  onSave: () => void;
}

const SignatureSection = ({
  agreement,
  signerName,
  signerTitle,
  agreementAccepted,
  cardAuthorizationAcknowledged,
  isSaving,
  onSignerNameChange,
  onSignerTitleChange,
  onAgreementAcceptedChange,
  onCardAuthorizationChange,
  onSave,
}: SignatureSectionProps) => {
  const isLocked = Boolean(agreement.locked_at);
  const evidenceRecorded = agreement.signature_status !== "pending";

  return (
    <section className="rounded-3xl border border-yellow-500/10 bg-black/25 p-8">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f4b000]">
        Signature and Authorization
      </p>
      <h2 className="mt-2 text-2xl font-black text-[#fff7ed]">
        Agreement acceptance evidence
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-[#b8a99a]">
        Record the signer’s typed legal name and explicit acknowledgments. No full
        card number or CVV is collected or stored by this application.
      </p>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <label className="text-sm font-bold text-[#d8cfc4]">
          Signer legal name
          <input
            type="text"
            value={signerName}
            disabled={isLocked}
            onChange={(event) => onSignerNameChange(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-yellow-500/10 bg-black/40 px-5 py-4 text-[#fff7ed] outline-none focus:border-yellow-500/40 disabled:opacity-60"
          />
        </label>
        <label className="text-sm font-bold text-[#d8cfc4]">
          Business title, when applicable
          <input
            type="text"
            value={signerTitle}
            disabled={isLocked}
            onChange={(event) => onSignerTitleChange(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-yellow-500/10 bg-black/40 px-5 py-4 text-[#fff7ed] outline-none focus:border-yellow-500/40 disabled:opacity-60"
          />
        </label>
      </div>

      <div className="mt-6 space-y-4">
        <label className="flex items-start gap-3 rounded-2xl border border-yellow-500/10 bg-black/30 p-5 text-sm leading-6 text-[#d8cfc4]">
          <input
            type="checkbox"
            checked={agreementAccepted}
            disabled={isLocked}
            onChange={(event) => onAgreementAcceptedChange(event.target.checked)}
            className="mt-1"
          />
          I confirm that the named signer explicitly accepts this exact Agreement
          version and its item, pricing, and legal snapshots.
        </label>

        <label className="flex items-start gap-3 rounded-2xl border border-yellow-500/10 bg-black/30 p-5 text-sm leading-6 text-[#d8cfc4]">
          <input
            type="checkbox"
            checked={cardAuthorizationAcknowledged}
            disabled={isLocked}
            onChange={(event) => onCardAuthorizationChange(event.target.checked)}
            className="mt-1"
          />
          The signer acknowledges the Agreement’s approved credit-card
          authorization terms. Card details remain with the approved payment provider.
        </label>
      </div>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-[#b8a99a]">
          <p>Evidence status: <strong className="text-[#fff7ed]">{agreement.signature_status}</strong></p>
          <p className="mt-1 break-all">Terms reference: {agreement.terms_version}</p>
          {agreement.signed_at && (
            <p className="mt-1">Recorded: {new Date(agreement.signed_at).toLocaleString()}</p>
          )}
        </div>
        <button
          type="button"
          disabled={isLocked || isSaving}
          onClick={onSave}
          className="rounded-full border border-yellow-500 bg-yellow-500/10 px-6 py-4 text-sm font-black uppercase tracking-[0.08em] text-[#f4b000] transition hover:bg-yellow-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "Recording..." : evidenceRecorded ? "Update Acceptance" : "Record Acceptance"}
        </button>
      </div>

      <p className="mt-6 rounded-2xl border border-yellow-500/10 bg-black/30 p-5 text-sm leading-7 text-[#d4c8bb]">
        Legal sufficiency and final Agreement wording require client and attorney approval
        before public launch.
      </p>
    </section>
  );
};

export default SignatureSection;
