import type { InvoiceItem } from "./invoiceItem";

export type InvoiceStatus =
  | "draft"
  | "issued"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled"
  | "void";

export type InvoiceType =
  | "original_rental"
  | "adjustment"
  | "credit_note"
  | "replacement"
  | "damage_charge";

export interface InvoiceSnapshot {
  id: string;
  rentalAgreementId: string | null;
  rentalRequestId: string | null;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  status: InvoiceStatus;
  customerType: "individual" | "business" | null;
  customerName: string;
  businessName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  billingAddress: string | null;
  serviceAddress: string | null;
  equipmentRequested: string | null;
  rentalStartDate: string | null;
  rentalEndDate: string | null;
  sourceAgreementSnapshotHash: string | null;
  currency: string;
  paymentTerms: string;
  subtotal: number;
  depositAmount: number;
  deliveryFee: number;
  taxAmount: number;
  otherChargesAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: string;
  paymentLink: string | null;
  notes: string | null;
  issueDate: string | null;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  pdfUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceAggregate {
  invoice: InvoiceSnapshot;
  items: readonly InvoiceItem[];
  itemSource: "normalized" | "legacy" | "unavailable";
}

export interface InvoicePayment {
  id: string;
  invoiceId: string;
  amount: number;
  paymentMethod: string;
  referenceNumber: string | null;
  notes: string | null;
  receivedAt: string;
  createdAt: string;
}

export interface RecordInvoicePaymentCommand {
  invoiceId: string;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  notes?: string;
}
