import type { InvoiceStatus } from "../domain/models/invoice";
import {
  formatDocumentDate,
  formatDocumentStatus,
} from "./documentPresentation";

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
  invoiceStatusLabels[status] || formatDocumentStatus(status);

export const formatInvoiceDate = (
  value: string | null | undefined,
  fallback = "Not recorded"
): string => formatDocumentDate(value, fallback);
