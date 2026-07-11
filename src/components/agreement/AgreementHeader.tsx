import type { RentalAgreement } from "../../types/agreement";

interface AgreementHeaderProps {
  agreement: RentalAgreement;
}

const AgreementHeader = ({ agreement }: AgreementHeaderProps) => {
  return (
    <header className="border-b border-yellow-500/20 pb-10">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.35em] text-[#f4b000]">
            Urban Cowboy Rentals
          </p>

          <h1 className="mt-4 text-4xl font-black text-[#fff7ed] sm:text-5xl">
            Equipment Rental Agreement
          </h1>

          <p className="mt-3 max-w-xl text-[#b8a99a]">
            This agreement outlines the rental terms, pricing, responsibilities,
            and conditions between Urban Cowboy Rentals and the customer listed
            below.
          </p>
        </div>

        <div className="rounded-3xl border border-yellow-500/20 bg-black/30 p-6 text-right">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8f8577]">
            Agreement Number
          </p>

          <h2 className="mt-2 text-3xl font-black text-[#fff7ed]">
            {agreement.agreement_number}
          </h2>

          <div className="mt-5 inline-flex rounded-full border border-yellow-500/20 bg-[#f4b000]/10 px-5 py-2 text-sm font-black uppercase tracking-[0.12em] text-[#f4b000]">
            {agreement.status}
          </div>
        </div>
      </div>
    </header>
  );
};

export default AgreementHeader;