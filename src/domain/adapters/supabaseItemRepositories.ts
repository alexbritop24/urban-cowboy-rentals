import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AgreementItemRepository,
  InvoiceItemRepository,
  RentalRequestItemRepository,
} from "../models/itemRepositories";
import type { AgreementItem } from "../models/agreementItem";
import type { InvoiceItem } from "../models/invoiceItem";
import type { RentalRequestItem } from "../models/rentalRequestItem";

type DatabaseRow = Record<string, unknown>;

const nullableString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const requiredString = (row: DatabaseRow, field: string): string =>
  typeof row[field] === "string" ? row[field] : "";

const numberValue = (row: DatabaseRow, field: string): number => {
  const value = Number(row[field]);
  return Number.isFinite(value) ? value : 0;
};

const mapBaseRow = (row: DatabaseRow) => ({
  id: requiredString(row, "id"),
  displayOrder: numberValue(row, "display_order"),
  equipmentId: nullableString(row.equipment_id),
  equipmentName: requiredString(row, "equipment_name"),
  startDate: requiredString(row, "start_date"),
  endDate: requiredString(row, "end_date"),
  quantity: numberValue(row, "quantity"),
  dailyRate: numberValue(row, "daily_rate"),
  serialNumber: nullableString(row.serial_number),
  notes: nullableString(row.notes),
  origin: "normalized" as const,
});

const mapRentalRequestItemRow = (row: DatabaseRow): RentalRequestItem => ({
  ...mapBaseRow(row),
  rentalRequestId: requiredString(row, "rental_request_id"),
  createdAt: nullableString(row.created_at),
  updatedAt: nullableString(row.updated_at),
});

const mapAgreementItemRow = (row: DatabaseRow): AgreementItem => ({
  ...mapBaseRow(row),
  rentalAgreementId: requiredString(row, "rental_agreement_id"),
  rentalRequestItemId: nullableString(row.rental_request_item_id),
  billableDays: numberValue(row, "billable_days"),
  lineTotal: numberValue(row, "line_total"),
  createdAt: nullableString(row.created_at),
});

const mapInvoiceItemRow = (row: DatabaseRow): InvoiceItem => ({
  ...mapBaseRow(row),
  invoiceId: requiredString(row, "invoice_id"),
  agreementItemId: nullableString(row.agreement_item_id),
  billableDays: numberValue(row, "billable_days"),
  lineTotal: numberValue(row, "line_total"),
  createdAt: nullableString(row.created_at),
});

const selectItems = async (
  client: SupabaseClient,
  table: "rental_request_items" | "agreement_items" | "invoice_items",
  parentField: "rental_request_id" | "rental_agreement_id" | "invoice_id",
  parentId: string
): Promise<DatabaseRow[]> => {
  const { data, error } = await client
    .from(table)
    .select("*")
    .eq(parentField, parentId)
    .order("display_order", { ascending: true });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? (data as DatabaseRow[]) : [];
};

export const createSupabaseRentalRequestItemRepository = (
  client: SupabaseClient
): RentalRequestItemRepository => ({
  async findByRentalRequestId(rentalRequestId) {
    const rows = await selectItems(
      client,
      "rental_request_items",
      "rental_request_id",
      rentalRequestId
    );
    return rows.map(mapRentalRequestItemRow);
  },
});

export const createSupabaseAgreementItemRepository = (
  client: SupabaseClient
): AgreementItemRepository => ({
  async findByRentalAgreementId(rentalAgreementId) {
    const rows = await selectItems(
      client,
      "agreement_items",
      "rental_agreement_id",
      rentalAgreementId
    );
    return rows.map(mapAgreementItemRow);
  },
});

export const createSupabaseInvoiceItemRepository = (
  client: SupabaseClient
): InvoiceItemRepository => ({
  async findByInvoiceId(invoiceId) {
    const rows = await selectItems(client, "invoice_items", "invoice_id", invoiceId);
    return rows.map(mapInvoiceItemRow);
  },
});
