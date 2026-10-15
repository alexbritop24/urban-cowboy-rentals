import type { AgreementClause } from "../../types/agreementClause";

interface Props {
  clauses: AgreementClause[];
}

export default function LegalClauses({ clauses }: Props) {
  return (
    <section className="document-section document-legal border-t border-[#d8d0c6] pt-7">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#76572f]">
        Persisted Legal Snapshot
      </p>

      <h2 className="mt-1 font-serif text-2xl font-bold text-[#211d18]">
        Terms and Conditions
      </h2>

      <div className="mt-6 space-y-6 font-serif">
  {Array.isArray(clauses) &&
    clauses.map((clause) => (
      <div key={clause.id}>
        <h3 className="text-base font-bold text-[#211d18]">
          {clause.title}
        </h3>

        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#3f3933]">
          {clause.body}
        </p>
      </div>
    ))}
</div>
    </section>
  );
}
