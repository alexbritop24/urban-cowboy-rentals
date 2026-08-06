import { assertValidPaymentAmount } from "../validators/paymentValidators";
import type {
  InvoiceAggregate,
  InvoicePayment,
  RecordInvoicePaymentCommand,
} from "../models/invoice";
import type { InvoiceRepository } from "../models/invoiceRepository";

const assertIdentifier = (value: string, label: string): void => {
  if (!value.trim()) throw new Error(`${label} is required.`);
};

const requireInvoice = async (
  repository: InvoiceRepository,
  invoiceId: string
): Promise<InvoiceAggregate> => {
  const aggregate = await repository.findById(invoiceId);
  if (!aggregate) throw new Error("Invoice not found.");
  return aggregate;
};

export interface InvoiceWorkflowService {
  loadInvoice(invoiceId: string): Promise<InvoiceAggregate | null>;
  createOrOpen(agreementId: string): Promise<InvoiceAggregate>;
  issue(invoiceId: string): Promise<InvoiceAggregate>;
  listPayments(invoiceId: string): Promise<readonly InvoicePayment[]>;
  recordPayment(
    command: RecordInvoicePaymentCommand
  ): Promise<{ invoice: InvoiceAggregate; paymentId: string }>;
}

export const createInvoiceWorkflowService = (
  repository: InvoiceRepository
): InvoiceWorkflowService => ({
  async loadInvoice(invoiceId) {
    assertIdentifier(invoiceId, "Invoice ID");
    return repository.findById(invoiceId);
  },

  async createOrOpen(agreementId) {
    assertIdentifier(agreementId, "Agreement ID");
    const invoiceId = await repository.createForAgreement(agreementId);
    return requireInvoice(repository, invoiceId);
  },

  async issue(invoiceId) {
    assertIdentifier(invoiceId, "Invoice ID");
    const issuedInvoiceId = await repository.issue(invoiceId);
    return requireInvoice(repository, issuedInvoiceId);
  },

  async listPayments(invoiceId) {
    assertIdentifier(invoiceId, "Invoice ID");
    return repository.listPayments(invoiceId);
  },

  async recordPayment(command) {
    assertIdentifier(command.invoiceId, "Invoice ID");
    assertValidPaymentAmount(command.amount);
    if (!command.paymentMethod.trim()) {
      throw new Error("Payment method is required.");
    }
    const current = await requireInvoice(repository, command.invoiceId);
    assertValidPaymentAmount(command.amount, current.invoice.balanceDue);
    const paymentId = await repository.recordPayment(command);
    return {
      invoice: await requireInvoice(repository, command.invoiceId),
      paymentId,
    };
  },
});
