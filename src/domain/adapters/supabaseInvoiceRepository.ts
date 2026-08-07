import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  InvoiceAggregate,
  InvoicePayment,
  InvoiceSnapshot,
  InvoiceStatus,
  InvoiceType,
} from "../models/invoice";
import type { InvoiceRepository } from "../models/invoiceRepository";
import { adaptLegacyInvoiceItem } from "./legacyItemAdapters";
import { createSupabaseInvoiceItemRepository } from "./supabaseItemRepositories";
import type { Database } from "../../types/database.generated";

type DatabaseRow = Record<string, unknown>;
type CreateInvoiceArgs =
  Database["public"]["Functions"]["create_invoice_for_agreement"]["Args"];
type IssueInvoiceArgs =
  Database["public"]["Functions"]["issue_invoice"]["Args"];
type RecordPaymentArgs =
  Database["public"]["Functions"]["record_invoice_payment"]["Args"];

const requiredString = (row: DatabaseRow, field: string): string =>
  typeof row[field] === "string" ? row[field] : "";

const nullableString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const numberValue = (row: DatabaseRow, field: string): number => {
  const value = Number(row[field]);
  return Number.isFinite(value) ? value : 0;
};

const mapInvoice = (row: DatabaseRow): InvoiceSnapshot => ({
  id: requiredString(row, "id"),
  rentalAgreementId: nullableString(row.rental_agreement_id),
  rentalRequestId: nullableString(row.rental_request_id),
  invoiceNumber: requiredString(row, "invoice_number"),
  invoiceType:
    (requiredString(row, "invoice_type") as InvoiceType) || "original_rental",
  status: requiredString(row, "status") as InvoiceStatus,
  customerType:
    row.customer_type === "individual" || row.customer_type === "business"
      ? row.customer_type
      : null,
  customerName: requiredString(row, "customer_name"),
  businessName: nullableString(row.business_name),
  customerEmail: nullableString(row.customer_email),
  customerPhone: nullableString(row.customer_phone),
  billingAddress: nullableString(row.billing_address),
  serviceAddress: nullableString(row.service_address),
  equipmentRequested: nullableString(row.equipment_requested),
  rentalStartDate: nullableString(row.rental_start_date),
  rentalEndDate: nullableString(row.rental_end_date),
  sourceAgreementSnapshotHash: nullableString(row.source_agreement_snapshot_hash),
  currency: requiredString(row, "currency") || "USD",
  paymentTerms: requiredString(row, "payment_terms") || "Not recorded",
  subtotal: numberValue(row, "subtotal"),
  depositAmount: numberValue(row, "deposit_amount"),
  deliveryFee: numberValue(row, "delivery_fee"),
  taxAmount: numberValue(row, "tax_amount"),
  otherChargesAmount: numberValue(row, "other_charges_amount"),
  totalAmount: numberValue(row, "total_amount"),
  amountPaid: numberValue(row, "amount_paid"),
  balanceDue: numberValue(row, "balance_due"),
  paymentStatus: requiredString(row, "payment_status") || "unpaid",
  paymentLink: nullableString(row.payment_link),
  notes: nullableString(row.notes),
  issueDate: nullableString(row.issue_date),
  issuedAt: nullableString(row.issued_at),
  dueAt: nullableString(row.due_at),
  paidAt: nullableString(row.paid_at),
  voidedAt: nullableString(row.voided_at),
  pdfUrl: nullableString(row.pdf_url),
  createdAt: requiredString(row, "created_at"),
  updatedAt: requiredString(row, "updated_at"),
});

const mapPayment = (row: DatabaseRow): InvoicePayment => ({
  id: requiredString(row, "id"),
  invoiceId: requiredString(row, "invoice_id"),
  amount: numberValue(row, "amount"),
  paymentMethod: requiredString(row, "payment_method"),
  referenceNumber: nullableString(row.reference_number),
  notes: nullableString(row.notes),
  receivedAt: requiredString(row, "received_at"),
  createdAt: requiredString(row, "created_at"),
});

const readRpcId = (value: unknown, operation: string): string => {
  if (typeof value === "string" && value) return value;
  throw new Error(`${operation} did not return an identifier.`);
};

const loadAggregate = async (
  client: SupabaseClient,
  invoiceId: string
): Promise<InvoiceAggregate | null> => {
  const { data: invoiceData, error: invoiceError } = await client
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();
  if (invoiceError) throw invoiceError;
  if (!invoiceData) return null;

  const invoice = mapInvoice(invoiceData as DatabaseRow);
  const normalizedItems = [
    ...(await createSupabaseInvoiceItemRepository(client).findByInvoiceId(
      invoiceId
    )),
  ];
  if (normalizedItems.length > 0) {
    return { invoice, items: normalizedItems, itemSource: "normalized" };
  }

  if (invoice.equipmentRequested) {
    return {
      invoice,
      items: [
        adaptLegacyInvoiceItem(
          invoice.id,
          {
            equipment_requested: invoice.equipmentRequested,
            rental_start_date: invoice.rentalStartDate,
            rental_end_date: invoice.rentalEndDate,
          },
          { dailyRate: 0, lineTotal: invoice.subtotal }
        ),
      ],
      itemSource: "legacy",
    };
  }

  return { invoice, items: [], itemSource: "unavailable" };
};

export const createSupabaseInvoiceRepository = (
  client: SupabaseClient
): InvoiceRepository => ({
  findById: (invoiceId) => loadAggregate(client, invoiceId),

  async createForAgreement(agreementId) {
    const args = {
      target_rental_agreement_id: agreementId,
    } satisfies CreateInvoiceArgs;
    const { data, error } = await client.rpc("create_invoice_for_agreement", args);
    if (error) throw error;
    return readRpcId(data, "Invoice creation");
  },

  async issue(invoiceId) {
    const args = { target_invoice_id: invoiceId } satisfies IssueInvoiceArgs;
    const { data, error } = await client.rpc("issue_invoice", args);
    if (error) throw error;
    return readRpcId(data, "Invoice issuance");
  },

  async listPayments(invoiceId) {
    const { data, error } = await client
      .from("payments")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("received_at", { ascending: false });
    if (error) throw error;
    return Array.isArray(data) ? (data as DatabaseRow[]).map(mapPayment) : [];
  },

  async recordPayment(command) {
    const args = {
      target_invoice_id: command.invoiceId,
      payment_amount: command.amount,
      payment_method_value: command.paymentMethod,
      reference_number_value: command.referenceNumber?.trim() || null,
      notes_value: command.notes?.trim() || null,
    } satisfies RecordPaymentArgs;
    const { data, error } = await client.rpc("record_invoice_payment", args);
    if (error) throw error;
    return readRpcId(data, "Payment recording");
  },
});
