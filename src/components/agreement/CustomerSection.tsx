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

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
            Full Name
          </p>
          <p className="mt-2 text-lg font-bold text-[#fff7ed]">
            {agreement.customer_name}
          </p>
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
            Phone
          </p>
          <p className="mt-2 text-lg text-[#fff7ed]">
            {agreement.customer_phone}
          </p>
        </div>

        <div className="sm:col-span-2">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
            Email
          </p>
          <p className="mt-2 break-words text-lg text-[#fff7ed]">
            {agreement.customer_email}
          </p>
        </div>
      </div>
    </section>
  );
};

export default CustomerSection;