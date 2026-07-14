import type { Invoice } from "../../types/invoice";

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
              {invoice.equipment_requested}
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8f8577]">
                Rental Start
              </p>

              <p className="mt-1 text-[#d8cfc4]">
                {invoice.rental_start_date || "Not set"}
              </p>
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8f8577]">
                Rental End
              </p>

              <p className="mt-1 text-[#d8cfc4]">
                {invoice.rental_end_date || "Not set"}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default InvoiceDetails;