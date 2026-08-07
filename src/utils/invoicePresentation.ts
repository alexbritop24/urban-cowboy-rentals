import type { InvoiceStatus } from "../domain/models/invoice";

const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  partially_paid: "Partially Paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
  void: "Void",
};

export const formatInvoiceStatus = (status: InvoiceStatus): string =>
  invoiceStatusLabels[status];

export const formatInvoiceDate = (
  value: string | null | undefined,
  fallback = "Not recorded"
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
