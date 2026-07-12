import type { AgreementClause } from "../../types/agreementClause";

interface Props {
  clauses: AgreementClause[];
}

export default function LegalClauses({ clauses }: Props) {
  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-black/20 p-8">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f4b000]">
        Terms & Conditions
      </p>

      <h2 className="mt-2 text-3xl font-black text-[#fff7ed]">
        Rental Agreement
      </h2>

      <div className="mt-8 space-y-8">
        {clauses.map((clause) => (
          <div key={clause.id}>
            <h3 className="text-lg font-bold text-[#fff7ed]">
              {clause.title}
            </h3>

            <p className="mt-2 whitespace-pre-wrap leading-7 text-[#b8a99a]">
              {clause.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}