import type { RentalAgreement } from "../../types/agreement";
import DocumentBrandHeader from "../document/DocumentBrandHeader";

interface AgreementHeaderProps {
  agreement: RentalAgreement;
}

const AgreementHeader = ({ agreement }: AgreementHeaderProps) => {
  return (
    <DocumentBrandHeader
      documentType="Equipment Rental Agreement"
      documentNumber={agreement.agreement_number}
      status={agreement.status}
      dateLabel="Effective"
      dateValue={agreement.effective_at}
    />
  );
};

export default AgreementHeader;
