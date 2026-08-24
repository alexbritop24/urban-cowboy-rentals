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
    <header className="document-brand-header border-b border-yellow-500/20 pb-8">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start">
          <img
            src={logo}
            alt="Urban Cowboy Rentals logo"
            className="h-24 w-24 shrink-0 rounded-2xl border border-yellow-500/15 bg-[#fff7ed] object-contain p-1 shadow-lg shadow-black/20"
          />

          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#f4b000]">
              {urbanCowboyDocumentBrand.legalName}
            </p>
            <h1 className="mt-2 text-4xl font-black text-[#fff7ed] sm:text-5xl">
              {documentType}
            </h1>
            <address className="mt-4 not-italic text-sm leading-6 text-[#b8a99a]">
              <span className="block">{urbanCowboyDocumentBrand.streetAddress}</span>
              <span className="block">{urbanCowboyDocumentBrand.locality}</span>
              <span className="block">
                {urbanCowboyDocumentBrand.phone} · {urbanCowboyDocumentBrand.email}
              </span>
            </address>
          </div>
        </div>

        <dl className="document-metadata min-w-[250px] rounded-3xl border border-yellow-500/20 bg-black/30 p-6 text-right">
          <div>
            <dt className="text-xs font-black uppercase tracking-[0.18em] text-[#8f8577]">
              Document Number
            </dt>
            <dd className="mt-2 break-words text-2xl font-black text-[#fff7ed]">
              {documentNumber}
            </dd>
          </div>
          <div className="mt-5">
            <dt className="sr-only">Status</dt>
            <dd className="flex flex-wrap items-center justify-end gap-3">
              <span className="rounded-full border border-yellow-500/20 bg-[#f4b000]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#f4b000]">
              {formatDocumentStatus(status)}
              </span>
            </dd>
          </div>
          <div className="mt-4">
            <dt className="text-xs font-black uppercase tracking-[0.12em] text-[#8f8577]">
              {dateLabel}
            </dt>
            <dd className="mt-1 text-sm text-[#d8cfc4]">
              {formatDocumentDate(dateValue)}
            </dd>
          </div>
        </dl>
      </div>
    </header>
  );
}
