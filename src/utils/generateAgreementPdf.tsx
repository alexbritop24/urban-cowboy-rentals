import { pdf } from "@react-pdf/renderer";

import AgreementPdfDocument from "../components/agreement/pdf/AgreementPdfDocument";
import type { RentalAgreement } from "../types/agreement";

export async function generateAgreementPdf(
  agreement: RentalAgreement
) {
  if (agreement.snapshot_availability.status !== "verified") {
    throw new Error(
      "An immutable Agreement snapshot is unavailable. PDF generation is disabled."
    );
  }

  const blob = await pdf(
    <AgreementPdfDocument agreement={agreement} />
  ).toBlob();

  const url = URL.createObjectURL(blob);

  window.open(url, "_blank");
}
