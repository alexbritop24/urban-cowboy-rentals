import type { Invoice } from "../../types/invoice";
import { formatInvoiceDate } from "../../utils/invoicePresentation";

interface InvoiceDetailsProps {
  invoice: Invoice;
}

const InvoiceDetails = ({ invoice }: InvoiceDetailsProps) => {
  return (
    <div className="grid gap-8 border-t border-[#d8d0c6] pt-6 lg:grid-cols-2">
      <section className="document-section">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#76572f]">
          Bill To
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#776b60]">
              Customer Legal Name
            </p>

            <p className="mt-1 font-serif text-xl font-bold text-[#211d18]">
              {invoice.customer_name}
            </p>
          </div>

          {invoice.customer_type === "business" && (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#776b60]">
                Business
              </p>
              <p className="mt-1 text-[#211d18]">
                {invoice.business_name || "Not recorded"}
              </p>
            </div>
          )}

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#776b60]">
              Email
            </p>

            <p className="mt-1 break-all text-[#211d18]">
              {invoice.customer_email || "Not provided"}
            </p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#776b60]">
              Phone
            </p>

            <p className="mt-1 text-[#211d18]">
              {invoice.customer_phone || "Not provided"}
            </p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#776b60]">
              Billing Address
            </p>
            <p className="mt-1 whitespace-pre-line text-[#211d18]">
              {invoice.billing_address || "Not provided"}
            </p>
          </div>
        </div>
      </section>

      <section className="document-section border-l-0 border-[#d8d0c6] lg:border-l lg:pl-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#76572f]">
          Invoice and Rental Details
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#776b60]">
              Equipment
            </p>

            <p className="mt-1 font-serif text-lg font-bold text-[#211d18]">
              {invoice.equipment_requested || "See itemized snapshot below"}
            </p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#776b60]">
              Rental Request
            </p>
            <p className="mt-1 break-all text-[#211d18]">
              {invoice.rental_request_id || "Not recorded on this historical Invoice"}
            </p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#776b60]">
              Source Agreement Record
            </p>
            <p className="mt-1 break-all text-[#211d18]">
              {invoice.rental_agreement_id || "Not recorded on this historical Invoice"}
            </p>
          </div>

          {invoice.source_agreement_snapshot_hash && (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#776b60]">
                Accepted Agreement Snapshot
              </p>
              <p className="mt-1 break-all font-mono text-xs leading-5 text-[#5f574f]">
                {invoice.source_agreement_snapshot_hash}
              </p>
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#776b60]">
                Rental Start
              </p>

              <p className="mt-1 text-[#211d18]">
                {formatInvoiceDate(invoice.rental_start_date, "Not set")}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#776b60]">
                Rental End
              </p>

              <p className="mt-1 text-[#211d18]">
                {formatInvoiceDate(invoice.rental_end_date, "Not set")}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#776b60]">
              Service / Delivery Address
            </p>
            <p className="mt-1 whitespace-pre-line text-[#211d18]">
              {invoice.service_address || "Not provided"}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default InvoiceDetails;
