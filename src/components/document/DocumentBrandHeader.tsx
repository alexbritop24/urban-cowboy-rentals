import logo from "../../assets/urban-cowboy-logo.jpeg";
import {
  formatDocumentDate,
  formatDocumentStatus,
  urbanCowboyDocumentBrand,
} from "../../utils/documentPresentation";

interface DocumentBrandHeaderProps {
  documentType: string;
  documentNumber: string;
  status: string;
  dateLabel: string;
  dateValue: string | null | undefined;
}

export default function DocumentBrandHeader({
  documentType,
  documentNumber,
  status,
  dateLabel,
  dateValue,
}: DocumentBrandHeaderProps) {
  return (
    <header className="document-brand-header border-b-2 border-[#9a6a28] pb-7">
      <div className="flex flex-col gap-7 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start">
          <img
            src={logo}
            alt="Urban Cowboy Rentals logo"
            className="h-20 w-20 shrink-0 border border-[#d8d0c6] bg-white object-contain p-1"
          />

          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#76572f]">
              {urbanCowboyDocumentBrand.legalName}
            </p>
            <h1 className="mt-2 font-serif text-3xl font-bold leading-tight text-[#211d18] sm:text-4xl">
              {documentType}
            </h1>
            <address className="mt-3 not-italic text-sm leading-5 text-[#5f574f]">
              <span className="block">{urbanCowboyDocumentBrand.streetAddress}</span>
              <span className="block">{urbanCowboyDocumentBrand.locality}</span>
              <span className="block">
                {urbanCowboyDocumentBrand.phone} · {urbanCowboyDocumentBrand.email}
              </span>
            </address>
          </div>
        </div>

        <dl className="document-metadata min-w-[220px] border-l border-[#d8d0c6] pl-6 text-left sm:text-right">
          <div>
            <dt className="text-xs font-bold uppercase tracking-[0.14em] text-[#776b60]">
              Number
            </dt>
            <dd className="mt-1 break-words text-xl font-bold text-[#211d18]">
              {documentNumber}
            </dd>
          </div>
          <div className="mt-4">
            <dt className="text-xs font-bold uppercase tracking-[0.14em] text-[#776b60]">
              Status
            </dt>
            <dd className="mt-1 font-bold text-[#76572f]">
              {formatDocumentStatus(status)}
            </dd>
          </div>
          <div className="mt-4">
            <dt className="text-xs font-bold uppercase tracking-[0.14em] text-[#776b60]">
              {dateLabel}
            </dt>
            <dd className="mt-1 text-sm text-[#211d18]">
              {formatDocumentDate(dateValue)}
            </dd>
          </div>
        </dl>
      </div>
    </header>
  );
}
