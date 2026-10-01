import type { RentalAgreement } from "../../types/agreement";

interface CustomerSectionProps {
  agreement: RentalAgreement;
}

const Detail = ({ label, value }: { label: string; value: string | null }) => (
  <div>
    <dt className="text-xs font-bold uppercase tracking-[0.12em] text-[#776b60]">
      {label}
    </dt>
    <dd className="mt-1 break-words text-[#211d18]">{value || "Not provided"}</dd>
  </div>
);

const CustomerSection = ({ agreement }: CustomerSectionProps) => (
  <section className="document-section border-t border-[#d8d0c6] pt-6">
    <h2 className="font-serif text-xl font-bold text-[#211d18]">
      Lessee and Rental Information
    </h2>

    <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
      <div>
        <dt className="text-xs font-bold uppercase tracking-[0.12em] text-[#776b60]">
          Lessee Type
        </dt>
        <dd className="mt-1 text-sm font-bold capitalize text-[#211d18]">
          {agreement.customer_type}
        </dd>
      </div>

      <Detail label="Lessee Legal Name" value={agreement.customer_name} />
      {agreement.customer_type === "business" && (
        <Detail label="Business Name" value={agreement.business_name} />
      )}
      <Detail label="Email Address" value={agreement.customer_email} />
      <Detail label="Phone Number" value={agreement.customer_phone} />
      <Detail label="Billing Address" value={agreement.billing_address} />
      <Detail label="Rental Request" value={agreement.rental_request_id} />
      <Detail label="Fulfillment" value={agreement.fulfillment_type} />
      {agreement.service_address && (
        <Detail label="Service / Delivery Address" value={agreement.service_address} />
      )}
    </dl>
  </section>
);

export default CustomerSection;
