import type { RentalAgreement } from "../../types/agreement";

interface AgreementHeaderProps {
  agreement: RentalAgreement;
}

const AgreementHeader = ({ agreement }: AgreementHeaderProps) => {
  return (
    <header className="border-b border-yellow-500/20 pb-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.35em] text-[#f4b000]">
            Urban Cowboy Rentals
          </p>

          <h1 className="mt-3 text-4xl font-black text-[#fff7ed] sm:text-5xl">
            Equipment Rental Agreement
          </h1>

          <p className="mt-3 text-sm text-[#b8a99a]">
            Agreement #{agreement.agreement_number}
          </p>
        </div>

        <div className="rounded-full border border-yellow-500/20 bg-[#f4b000]/10 px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-[#f4b000]">
          {agreement.status}
        </div>
      </div>
    </header>
  );
};

export default AgreementHeader;