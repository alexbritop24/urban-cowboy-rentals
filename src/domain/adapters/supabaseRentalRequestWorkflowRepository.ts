import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  PreparedRentalRequestCommand,
  RentalRequestCreationResult,
  ReplaceRentalRequestItemsCommand,
} from "../models/rentalRequestWorkflow";
import type { RentalRequestWorkflowRepository } from "../models/rentalRequestWorkflowRepository";

type RpcResult = string | { id?: unknown; rental_request_id?: unknown } | null;

const dateOnly = (value: string): string | null =>
  value ? value.split("T")[0] ?? null : null;

const mapItems = (command: Pick<PreparedRentalRequestCommand, "items">) =>
  command.items.map((item) => ({
    display_order: item.displayOrder,
    equipment_id: item.equipmentId,
    equipment_name: item.equipmentName,
    start_date: item.startDate,
    end_date: item.endDate,
    quantity: item.quantity,
    daily_rate: item.dailyRate,
    serial_number: item.serialNumber,
    notes: item.notes,
  }));

const readRequestId = (data: RpcResult): string => {
  if (typeof data === "string" && data) return data;

  if (data && typeof data === "object") {
    const value = data.rental_request_id ?? data.id;
    if (typeof value === "string" && value) return value;
  }

  throw new Error("The request was created without returning its identifier.");
};

export const createSupabaseRentalRequestWorkflowRepository = (
  client: SupabaseClient
): RentalRequestWorkflowRepository => ({
  async createWithItems(command): Promise<RentalRequestCreationResult> {
    const { request } = command;
    const { data, error } = await client.rpc(
      "create_rental_request_with_items",
      {
        request_payload: {
          customer_type: request.customerType,
          full_name: request.fullName,
          business_name:
            request.customerType === "business" ? request.businessName : null,
          phone: request.phone,
          email: request.email,
          equipment_requested: command.legacyFields.equipment_requested,
          rental_start_date: dateOnly(command.pickupDate),
          rental_end_date: dateOnly(command.returnDate),
          pickup_date: command.pickupDate,
          return_date: command.returnDate,
          rental_duration: command.rentalDuration,
          fulfillment_type: request.fulfillmentType,
          project_type: request.projectType,
          notes: request.notes,
          agreement_accepted: request.agreementAccepted,
          status: "new",
          source: "website",
          priority: "normal",
          payment_status: "unpaid",
          deposit_status: "not_required",
          delivery_status: "not_scheduled",
          availability_status: "pending_review",
          availability_notes: null,
        },
        item_payloads: mapItems(command),
      }
    );

    if (error) throw error;
    return { rentalRequestId: readRequestId(data as RpcResult) };
  },

  async replaceItems(command: ReplaceRentalRequestItemsCommand): Promise<void> {
    const { error } = await client.rpc("replace_rental_request_items", {
      target_rental_request_id: command.rentalRequestId,
      item_payloads: mapItems(command),
      legacy_fields: {
        equipment_requested: command.legacyFields.equipment_requested,
        rental_start_date: dateOnly(command.pickupDate),
        rental_end_date: dateOnly(command.returnDate),
        pickup_date: command.pickupDate,
        return_date: command.returnDate,
        rental_duration: command.rentalDuration,
        quote_amount: command.estimatedSubtotal,
        availability_status: "pending_review",
        availability_notes: "Item schedule changed; availability requires review.",
      },
    });

    if (error) throw error;
  },
});
