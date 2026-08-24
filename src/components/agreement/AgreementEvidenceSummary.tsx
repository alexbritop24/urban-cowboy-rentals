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
    <section className="document-section rounded-3xl border border-yellow-500/20 bg-black/20 p-8">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f4b000]">
        Persisted Agreement Evidence
      </p>
      <h2 className="mt-2 text-3xl font-black text-[#fff7ed]">
        Snapshot and Acceptance Record
      </h2>

      <dl className="mt-8 grid gap-4 md:grid-cols-2">
        {evidence.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-yellow-500/10 bg-black/30 p-4"
          >
            <dt className="text-xs font-black uppercase tracking-[0.12em] text-[#8f8577]">
              {item.label}
            </dt>
            <dd className="mt-2 text-sm font-bold text-[#fff7ed]">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 space-y-2 break-all text-xs leading-5 text-[#b8a99a]">
        <p>
          Current snapshot: {agreement.current_snapshot_hash || "Not recorded"}
        </p>
        <p>
          Accepted snapshot: {agreement.accepted_snapshot_hash || "Not recorded"}
        </p>
      </div>

      <p className="mt-6 rounded-2xl border border-yellow-500/10 bg-black/30 p-4 text-sm leading-6 text-[#b8a99a]">
        {agreementEvidenceLimitation}
      </p>
    </section>
  );
}
