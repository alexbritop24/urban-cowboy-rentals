import { pdf } from "@react-pdf/renderer";

import AgreementPdfDocument from "../components/agreement/pdf/AgreementPdfDocument";
import type { RentalAgreement } from "../types/agreement";
import type { AgreementClause } from "../types/agreementClause";

export async function generateAgreementPdf(
  agreement: RentalAgreement,
  clauses: AgreementClause[]
) {
  const blob = await pdf(
    <AgreementPdfDocument
      agreement={agreement}
      clauses={clauses}
    />
  ).toBlob();

  const url = URL.createObjectURL(blob);

  window.open(url, "_blank");
}