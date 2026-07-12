import type { RentalAgreement } from "../../types/agreement";

interface SignatureSectionProps {
  agreement: RentalAgreement;
}

const SignatureSection = ({ agreement }: SignatureSectionProps) => {
  const signedDate = agreement.signed_at
    ? new Date(agreement.signed_at).toLocaleDateString()
    : "Not signed";

  return (
    <section className="rounded-3xl border border-yellow-500/10 bg-black/25 p-8">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f4b000]">
          Signatures
        </p>

        <h2 className="mt-2 text-2xl font-black text-[#fff7ed]">
          Agreement acceptance
        </h2>

        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#b8a99a]">
          By signing, the customer acknowledges that they reviewed the
          agreement, accepted the rental charges, and agreed to the approved
          terms and conditions.
        </p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="rounded-2xl border border-yellow-500/10 bg-black/30 p-6">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
            Customer
          </p>

          <p className="mt-3 text-xl font-bold text-[#fff7ed]">
            {agreement.customer_name}
          </p>

          <div className="mt-10 border-b border-[#8f8577]" />

          <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[#8f8577]">
            Customer signature
          </p>

          <div className="mt-8 border-b border-[#8f8577]" />

          <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[#8f8577]">
            Date: {signedDate}
          </p>
        </div>

        <div className="rounded-2xl border border-yellow-500/10 bg-black/30 p-6">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
            Rental Company
          </p>

          <p className="mt-3 text-xl font-bold text-[#fff7ed]">
            Urban Cowboy Rentals
          </p>

          <div className="mt-10 border-b border-[#8f8577]" />

          <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[#8f8577]">
            Authorized representative
          </p>

          <div className="mt-8 border-b border-[#8f8577]" />

          <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[#8f8577]">
            Date
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-yellow-500/10 bg-black/30 p-5">
        <p className="text-sm leading-7 text-[#d4c8bb]">
          Electronic signatures and electronic records may be used after the
          final agreement language and signing workflow are approved for public
          use.
        </p>
      </div>
    </section>
  );
};

export default SignatureSection;