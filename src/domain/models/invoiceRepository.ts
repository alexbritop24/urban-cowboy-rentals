import type {
  InvoiceAggregate,
  InvoicePayment,
  RecordInvoicePaymentCommand,
} from "./invoice";

export interface InvoiceRepository {
  findById(invoiceId: string): Promise<InvoiceAggregate | null>;
  createForAgreement(agreementId: string): Promise<string>;
  issue(invoiceId: string): Promise<string>;
  listPayments(invoiceId: string): Promise<readonly InvoicePayment[]>;
  recordPayment(command: RecordInvoicePaymentCommand): Promise<string>;
}
