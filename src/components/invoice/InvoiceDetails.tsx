import type { Invoice } from "../../types/invoice";
import { formatInvoiceDate } from "../../utils/invoicePresentation";

interface InvoiceDetailsProps {
  invoice: Invoice;
}

const InvoiceDetails = ({ invoice }: InvoiceDetailsProps) => {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
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
              {invoice.customer_name}
            </p>
          </div>

          {invoice.customer_type === "business" && (
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8f8577]">
                Business
              </p>
              <p className="mt-1 text-[#d8cfc4]">
                {invoice.business_name || "Not recorded"}
              </p>
            </div>
          )}

          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8f8577]">
              Email
            </p>

            <p className="mt-1 break-all text-[#d8cfc4]">
              {invoice.customer_email || "Not provided"}
            </p>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8f8577]">
              Phone
            </p>

            <p className="mt-1 text-[#d8cfc4]">
              {invoice.customer_phone || "Not provided"}
            </p>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8f8577]">
              Billing Address
            </p>
            <p className="mt-1 whitespace-pre-line text-[#d8cfc4]">
              {invoice.billing_address || "Not provided"}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-yellow-500/10 bg-black/25 p-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f4b000]">
          Rental Information
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8f8577]">
              Equipment
            </p>

            <p className="mt-1 text-xl font-bold text-[#fff7ed]">
              {invoice.equipment_requested || "See itemized snapshot below"}
            </p>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8f8577]">
              Source Agreement
            </p>
            <p className="mt-1 break-all text-[#d8cfc4]">
              {invoice.rental_agreement_id || "Not recorded on this historical Invoice"}
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8f8577]">
                Rental Start
              </p>

              <p className="mt-1 text-[#d8cfc4]">
                {formatInvoiceDate(invoice.rental_start_date, "Not set")}
              </p>
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8f8577]">
                Rental End
              </p>

              <p className="mt-1 text-[#d8cfc4]">
                {formatInvoiceDate(invoice.rental_end_date, "Not set")}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8f8577]">
              Service / Delivery Address
            </p>
            <p className="mt-1 whitespace-pre-line text-[#d8cfc4]">
              {invoice.service_address || "Not provided"}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default InvoiceDetails;
