import type { RentalAgreement } from "../types/agreement";

export const urbanCowboyDocumentBrand = Object.freeze({
  legalName: "Urban Cowboy Rentals LLC",
  streetAddress: "1032 E 1700 S",
  locality: "Salt Lake City, Utah 84105",
  phone: "801-903-9380",
  email: "urbancowboyrentals@gmail.com",
});

export const urbanCowboyDocumentTimeZone = "America/Denver";

export const formatDocumentStatus = (status: string): string =>
  status
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export const formatDocumentDate = (
  value: string | null | undefined,
  fallback = "Not provided"
): string => {
  if (!value) return fallback;

  const parsed = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value
  );

  if (Number.isNaN(parsed.getTime())) return fallback;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
};

export const formatDocumentDateTime = (
  value: string | null | undefined,
  fallback = "Not recorded"
): string => {
  if (!value) return fallback;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: urbanCowboyDocumentTimeZone,
    timeZoneName: "short",
  }).format(parsed);
};

export const formatDocumentCurrency = (
  value: number,
  currency = "USD"
): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));

export const formatDocumentSerial = (
  value: string | null | undefined
): string => {
  if (!value) return "Not recorded";
  return value.match(/.{1,6}/g)?.join(" ") ?? value;
};

export interface DocumentEvidenceRow {
  label: string;
  value: string;
}

export const agreementEvidenceLimitation =
  "Driver-license verification is not embedded in the Agreement record. Current document-workflow state is intentionally excluded from this artifact.";

const snapshotRelationship = (agreement: RentalAgreement): string => {
  const current = agreement.current_snapshot_hash;
  const accepted = agreement.accepted_snapshot_hash;

  if (current && accepted) {
    return current === accepted
      ? "Accepted snapshot matches current snapshot"
      : "Accepted snapshot differs from current snapshot";
  }
  if (accepted) return "Current snapshot not recorded; accepted snapshot recorded";
  if (current) return "Accepted snapshot not recorded";
  return "Current and accepted snapshots not recorded";
};

export const getAgreementEvidenceRows = (
  agreement: RentalAgreement
): readonly DocumentEvidenceRow[] => [
  {
    label: "Final Agreement status",
    value: agreement.locked_at
      ? "Finalized and locked"
      : formatDocumentStatus(agreement.status),
  },
  {
    label: "Signature status",
    value: formatDocumentStatus(agreement.signature_status),
  },
  {
    label: "Agreement acceptance",
    value: agreement.acceptance_acknowledged ? "Accepted" : "Pending",
  },
  {
    label: "Signer legal name",
    value: agreement.authorized_signer_name || "Not recorded",
  },
  {
    label: "Signer title",
    value: agreement.authorized_signer_title || "Not recorded",
  },
  {
    label: "Acceptance recorded",
    value: formatDocumentDateTime(agreement.signed_at),
  },
  {
    label: "Card authorization",
    value: agreement.credit_card_authorization_acknowledged
      ? "Acknowledged"
      : "Pending",
  },
  {
    label: "Card authorization recorded",
    value: formatDocumentDateTime(
      agreement.credit_card_authorization_acknowledged_at
    ),
  },
  {
    label: "Initial availability status",
    value: formatDocumentStatus(agreement.availability_confirmation_status),
  },
  {
    label: "Insurance verification status",
    value: formatDocumentStatus(agreement.insurance_verification_status),
  },
  {
    label: "Snapshot schema version",
    value:
      agreement.snapshot_schema_version === null
        ? "Not recorded"
        : String(agreement.snapshot_schema_version),
  },
  {
    label: "Snapshot relationship",
    value: snapshotRelationship(agreement),
  },
];

export interface DocumentPrintReadiness {
  enabled: boolean;
  message: string;
}

export const getAgreementPrintReadiness = (
  snapshotAvailability: RentalAgreement["snapshot_availability"]
): DocumentPrintReadiness =>
  snapshotAvailability.status === "verified"
    ? { enabled: true, message: "Agreement printing is available." }
    : {
        enabled: false,
        message:
          "Printing is unavailable because this historical Agreement lacks a verified immutable Release 1 snapshot.",
      };

export type PaymentHistoryLoadState =
  | { status: "loading"; paymentCount: 0 }
  | { status: "ready"; paymentCount: number }
  | { status: "error"; paymentCount: 0; message: string };

export const loadingPaymentHistoryState: PaymentHistoryLoadState = Object.freeze({
  status: "loading",
  paymentCount: 0,
});

export const getInvoicePrintReadiness = (
  paymentHistory: PaymentHistoryLoadState
): DocumentPrintReadiness => {
  if (paymentHistory.status === "loading") {
    return {
      enabled: false,
      message: "Printing is unavailable while payment history is loading.",
    };
  }
  if (paymentHistory.status === "error") {
    return {
      enabled: false,
      message:
        "Printing is unavailable because payment history could not be loaded.",
    };
  }
  return {
    enabled: true,
    message:
      paymentHistory.paymentCount === 0
        ? "Payment history loaded. No payments are recorded."
        : `Payment history loaded with ${paymentHistory.paymentCount} payment${
            paymentHistory.paymentCount === 1 ? "" : "s"
          }.`,
  };
};
