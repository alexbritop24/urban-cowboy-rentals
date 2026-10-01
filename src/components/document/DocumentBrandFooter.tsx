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
    <footer className="document-brand-footer border-t border-[#9a6a28] pt-4 text-xs text-[#5f574f]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-bold text-[#211d18]">
          {urbanCowboyDocumentBrand.legalName} · {documentType} {documentNumber}
        </p>
        <p>
          {urbanCowboyDocumentBrand.phone} · {urbanCowboyDocumentBrand.email}
        </p>
      </div>
    </footer>
  );
}
