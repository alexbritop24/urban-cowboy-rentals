import type { ReactNode } from "react";

import type { DocumentPrintReadiness } from "../../utils/documentPresentation";

interface DocumentPrintBoundaryProps {
  children: ReactNode;
  className: string;
  documentType: "Agreement" | "Invoice";
  readiness: DocumentPrintReadiness;
}

export default function DocumentPrintBoundary({
  children,
  className,
  documentType,
  readiness,
}: DocumentPrintBoundaryProps) {
  const isAgreement = documentType === "Agreement";
  const unavailableClass = isAgreement
    ? "document-print-unverified"
    : "document-print-invoice-unready";
  const warningClass = isAgreement
    ? "document-historical-print-warning"
    : "document-print-readiness-warning";

  return (
    <section
      className={`${className}${readiness.enabled ? "" : ` ${unavailableClass}`}`}
      data-print-ready={readiness.enabled ? "true" : "false"}
    >
      {!readiness.enabled && (
        <section
          className={`document-print-only ${warningClass}`}
          aria-label={`${documentType} printing unavailable`}
        >
          <h1>
            {isAgreement
              ? "Historical Agreement - Printing Unavailable"
              : "Invoice Printing Unavailable"}
          </h1>
          {isAgreement ? (
            <p>
              This record lacks a verified immutable Release 1 snapshot and is
              not an authoritative printable Agreement.
            </p>
          ) : (
            <>
              <p>{readiness.message}</p>
              <p>
                Authoritative payment history must load successfully before this
                Invoice can be printed.
              </p>
            </>
          )}
        </section>
      )}
      {children}
    </section>
  );
}
