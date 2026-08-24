import type { Invoice } from "../../types/invoice";
import DocumentBrandHeader from "../document/DocumentBrandHeader";

interface Props {
  invoice: Invoice;
}

export default function InvoiceHeader({ invoice }: Props) {
  return (
    <DocumentBrandHeader
      documentType="Equipment Rental Invoice"
      documentNumber={invoice.invoice_number}
      status={invoice.status}
      dateLabel={invoice.issued_at ? "Issued" : "Created"}
      dateValue={invoice.issued_at || invoice.created_at}
    />
  );
}
