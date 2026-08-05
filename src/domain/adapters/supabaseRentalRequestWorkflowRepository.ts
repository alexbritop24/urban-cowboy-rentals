import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  PreparedRentalRequestCommand,
  RentalRequestCreationResult,
  ReplaceRentalRequestItemsCommand,
} from "../models/rentalRequestWorkflow";
import type { RentalRequestWorkflowRepository } from "../models/rentalRequestWorkflowRepository";
import type { Database } from "../../types/database.generated";

type RpcResult = string | { id?: unknown; rental_request_id?: unknown } | null;
type CreateRequestRpcArgs =
  Database["public"]["Functions"]["create_rental_request_with_items"]["Args"];
type ReplaceItemsRpcArgs =
  Database["public"]["Functions"]["replace_rental_request_items"]["Args"];
type EditabilityRpcArgs =
  Database["public"]["Functions"]["get_rental_request_item_editability"]["Args"];

const mapItems = (command: Pick<PreparedRentalRequestCommand, "items">) =>
  command.items.map((item) => ({
    equipment_id: item.equipmentId,
    start_date: item.startDate,
    end_date: item.endDate,
    quantity: item.quantity,
    notes: item.notes,
  }));

const readEditability = (data: unknown) => {
  if (!data || typeof data !== "object") {
    throw new Error("The server returned an invalid item-editability response.");
  }

  const value = data as Record<string, unknown>;
  if (typeof value.editable !== "boolean" || typeof value.reason !== "string") {
    throw new Error("The server returned an invalid item-editability response.");
  }

  return { editable: value.editable, reason: value.reason };
};

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
    const rpcArguments = {
      request_payload: {
        customer_type: request.customerType,
        full_name: request.fullName,
        business_name:
          request.customerType === "business" ? request.businessName : null,
        phone: request.phone,
        email: request.email,
        fulfillment_type: request.fulfillmentType,
        project_type: request.projectType,
        notes: request.notes,
        agreement_accepted: request.agreementAccepted,
      },
      item_payloads: mapItems(command),
    } satisfies CreateRequestRpcArgs;
    const { data, error } = await client.rpc(
      "create_rental_request_with_items",
      rpcArguments
    );

    if (error) throw error;
    return { rentalRequestId: readRequestId(data as RpcResult) };
  },

  async replaceItems(command: ReplaceRentalRequestItemsCommand): Promise<void> {
    const rpcArguments = {
      target_rental_request_id: command.rentalRequestId,
      item_payloads: mapItems(command),
      legacy_fields: {},
    } satisfies ReplaceItemsRpcArgs;
    const { error } = await client.rpc(
      "replace_rental_request_items",
      rpcArguments
    );

    if (error) throw error;
  },

  async getEditability(rentalRequestId) {
    const rpcArguments = {
      target_rental_request_id: rentalRequestId,
    } satisfies EditabilityRpcArgs;
    const { data, error } = await client.rpc(
      "get_rental_request_item_editability",
      rpcArguments
    );

    if (error) throw error;
    return readEditability(data);
  },
});
