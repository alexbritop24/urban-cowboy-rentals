import type { RentalAgreement } from "../../types/agreement";

interface CustomerSectionProps {
  agreement: RentalAgreement;
}

const CustomerSection = ({ agreement }: CustomerSectionProps) => {
  return (
    <section className="rounded-3xl border border-yellow-500/10 bg-black/25 p-6">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f4b000]">
        Customer Information
      </p>

      <div className="mt-6 space-y-5">

        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8f8577]">
            Full Name
          </p>

          <p className="mt-1 text-xl font-bold text-[#fff7ed]">
            {agreement.customer_name}
          </p>
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8f8577]">
            Email Address
          </p>

          <p className="mt-1 break-all text-[#d8cfc4]">
            {agreement.customer_email}
          </p>
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8f8577]">
            Phone Number
          </p>

          <p className="mt-1 text-[#d8cfc4]">
            {agreement.customer_phone}
          </p>
        </div>

      </div>
    </section>
  );
};

export default CustomerSection;