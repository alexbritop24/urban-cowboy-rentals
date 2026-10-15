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
  const isReadOnly = isLocked || evidenceRecorded;
  const hasVerifiedSnapshot = agreement.snapshot_availability.status === "verified";

  return (
    <section className="document-section document-signature border-t border-[#d8d0c6] pt-7">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#76572f]">
        Acceptance and Authorization
      </p>
      <h2 className="mt-1 font-serif text-2xl font-bold text-[#211d18]">
        Lessee Acceptance
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5f574f]">
        Record the signer’s typed legal name and explicit acknowledgments. No full
        card number or CVV is collected or stored by this application.
      </p>

      {agreement.credit_card_authorization_terms && (
        <div className="mt-5 border border-[#d8d0c6] bg-[#faf7f2] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#776b60]">
            Credit-card authorization acknowledgment
          </p>
          <p className="mt-2 text-sm leading-6 text-[#3f3933]">
          {agreement.credit_card_authorization_terms}
          </p>
        </div>
      )}

      <div className="document-screen-only mt-8 grid gap-5 lg:grid-cols-2">
        <label className="text-sm font-bold text-[#3f3933]">
          Signer legal name
          <input
            type="text"
            value={signerName}
            disabled={isReadOnly || !hasVerifiedSnapshot}
            onChange={(event) => onSignerNameChange(event.target.value)}
            className="mt-2 w-full border border-[#b8afa4] bg-white px-4 py-3 text-[#211d18] outline-none focus:border-[#9a6a28] disabled:bg-[#f4eee5] disabled:opacity-70"
          />
        </label>
        <label className="text-sm font-bold text-[#3f3933]">
          Business title, when applicable
          <input
            type="text"
            value={signerTitle}
            disabled={isReadOnly || !hasVerifiedSnapshot}
            onChange={(event) => onSignerTitleChange(event.target.value)}
            className="mt-2 w-full border border-[#b8afa4] bg-white px-4 py-3 text-[#211d18] outline-none focus:border-[#9a6a28] disabled:bg-[#f4eee5] disabled:opacity-70"
          />
        </label>
      </div>

      <div className="document-screen-only mt-6 space-y-4">
        <label className="flex items-start gap-3 border border-[#d8d0c6] bg-[#faf7f2] p-4 text-sm leading-6 text-[#3f3933]">
          <input
            type="checkbox"
            checked={agreementAccepted}
            disabled={isReadOnly || !hasVerifiedSnapshot}
            onChange={(event) => onAgreementAcceptedChange(event.target.checked)}
            className="mt-1"
          />
          I confirm that the named signer explicitly accepts this exact Agreement
          version and its item, pricing, and legal snapshots.
        </label>

        <label className="flex items-start gap-3 border border-[#d8d0c6] bg-[#faf7f2] p-4 text-sm leading-6 text-[#3f3933]">
          <input
            type="checkbox"
            checked={cardAuthorizationAcknowledged}
            disabled={isReadOnly || !hasVerifiedSnapshot}
            onChange={(event) => onCardAuthorizationChange(event.target.checked)}
            className="mt-1"
          />
          The signer acknowledges the Agreement’s approved credit-card
          authorization terms. Card details remain with the approved payment provider.
        </label>
      </div>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-[#5f574f]">
          <p>
            Signer: <strong className="text-[#211d18]">
              {agreement.authorized_signer_name || "Not recorded"}
            </strong>
          </p>
          {agreement.authorized_signer_title && (
            <p className="mt-1">Title: {agreement.authorized_signer_title}</p>
          )}
          <p>Evidence status: <strong className="text-[#211d18]">{agreement.signature_status}</strong></p>
          <p className="mt-1">
            Agreement accepted: {agreement.acceptance_acknowledged ? "Yes" : "Pending"}
          </p>
          <p className="mt-1">
            Card authorization acknowledgment:{" "}
            {agreement.credit_card_authorization_acknowledged ? "Acknowledged" : "Pending"}
          </p>
          <p className="mt-1 break-all">
            Clause reference: {agreement.terms_version || "Unavailable"}
          </p>
          <p className="mt-1 break-all">
            Material snapshot: {agreement.accepted_snapshot_hash || agreement.current_snapshot_hash || "Unavailable"}
          </p>
          {agreement.signed_at && (
            <p className="mt-1">Recorded: {new Date(agreement.signed_at).toLocaleString()}</p>
          )}
        </div>
        <button
          type="button"
          disabled={isReadOnly || !hasVerifiedSnapshot || isSaving}
          onClick={onSave}
          className="document-no-print rounded-full border border-[#9a6a28] bg-[#fff8e7] px-6 py-4 text-sm font-black uppercase tracking-[0.08em] text-[#76572f] transition hover:bg-[#f4eee5] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "Recording..." : evidenceRecorded ? "Acceptance Recorded" : "Record Acceptance"}
        </button>
      </div>

      <p className="document-no-print mt-6 border-l-2 border-amber-600 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        Legal sufficiency and final Agreement wording require client and attorney approval
        before public launch.
      </p>
    </section>
  );
};

export default SignatureSection;
