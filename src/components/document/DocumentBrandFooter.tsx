import { urbanCowboyDocumentBrand } from "../../utils/documentPresentation";

interface DocumentBrandFooterProps {
  documentType: "Agreement" | "Invoice";
  documentNumber: string;
}

export default function DocumentBrandFooter({
  documentType,
  documentNumber,
}: DocumentBrandFooterProps) {
  return (
    <footer className="document-brand-footer border-t border-yellow-500/20 pt-6 text-sm text-[#8f8577]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-bold text-[#d8cfc4]">
          {urbanCowboyDocumentBrand.legalName} · {documentType} {documentNumber}
        </p>
        <p>
          {urbanCowboyDocumentBrand.phone} · {urbanCowboyDocumentBrand.email}
        </p>
      </div>
    </footer>
  );
}
