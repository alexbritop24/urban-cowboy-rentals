import { pdf } from "@react-pdf/renderer";

import InvoicePdfDocument from "../components/agreement/pdf/InvoicePdfDocument";
import type { Invoice } from "../types/invoice";

export async function generateInvoicePdf(
  invoice: Invoice
) {
  const blob = await pdf(
    <InvoicePdfDocument invoice={invoice} />
  ).toBlob();

  const url = URL.createObjectURL(blob);

  window.open(url, "_blank");
}