import type { RentalAgreement } from "../../types/agreement";

interface CustomerSectionProps {
  agreement: RentalAgreement;
}

const Detail = ({ label, value }: { label: string; value: string | null }) => (
  <div>
    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8f8577]">
      {label}
    </p>
    <p className="mt-1 break-words text-[#d8cfc4]">{value || "Not provided"}</p>
  </div>
);

const CustomerSection = ({ agreement }: CustomerSectionProps) => (
  <section className="rounded-3xl border border-yellow-500/10 bg-black/25 p-6">
    <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f4b000]">
      Customer Information
    </p>

    <div className="mt-6 space-y-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8f8577]">
          Customer Type
        </p>
        <p className="mt-1 text-sm font-black uppercase tracking-[0.1em] text-[#f4b000]">
          {agreement.customer_type}
        </p>
      </div>

      <Detail label="Legal Name" value={agreement.customer_name} />
      {agreement.customer_type === "business" && (
        <Detail label="Business Name" value={agreement.business_name} />
      )}
      <Detail label="Email Address" value={agreement.customer_email} />
      <Detail label="Phone Number" value={agreement.customer_phone} />
      <Detail label="Billing Address" value={agreement.billing_address} />
      {agreement.fulfillment_type === "Delivery" && (
        <Detail label="Service / Delivery Address" value={agreement.service_address} />
      )}
    </div>
  </section>
);

export default CustomerSection;
