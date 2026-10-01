import type { RentalAgreement } from "../../types/agreement";
import {
  agreementEvidenceLimitation,
  getAgreementEvidenceRows,
} from "../../utils/documentPresentation";

interface AgreementEvidenceSummaryProps {
  agreement: RentalAgreement;
}

export default function AgreementEvidenceSummary({
  agreement,
}: AgreementEvidenceSummaryProps) {
  const evidence = getAgreementEvidenceRows(agreement);

  return (
    <section className="document-section border-t border-dashed border-[#b8afa4] pt-6">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#76572f]">
        Internal Agreement Record
      </p>
      <h2 className="mt-1 font-serif text-xl font-bold text-[#211d18]">
        Snapshot and Acceptance Record
      </h2>
      <p className="mt-2 text-xs leading-5 text-[#6f665c]">
        Administrative evidence retained with this Agreement; not a substitute for the persisted legal terms above.
      </p>

      <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {evidence.map((item) => (
          <div
            key={item.label}
            className="border-b border-[#e4ddd4] pb-3"
          >
            <dt className="text-xs font-bold uppercase tracking-[0.1em] text-[#776b60]">
              {item.label}
            </dt>
            <dd className="mt-1 text-sm font-semibold text-[#211d18]">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 space-y-2 break-all font-mono text-[11px] leading-5 text-[#5f574f]">
        <p>
          Current snapshot: {agreement.current_snapshot_hash || "Not recorded"}
        </p>
        <p>
          Accepted snapshot: {agreement.accepted_snapshot_hash || "Not recorded"}
        </p>
      </div>

      <p className="mt-5 border-l-2 border-[#9a6a28] pl-4 text-xs leading-5 text-[#5f574f]">
        {agreementEvidenceLimitation}
      </p>
    </section>
  );
}
