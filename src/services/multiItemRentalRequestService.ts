import { createSupabaseRentalRequestItemRepository } from "../domain/adapters/supabaseItemRepositories";
import { createSupabaseRentalRequestWorkflowRepository } from "../domain/adapters/supabaseRentalRequestWorkflowRepository";
import { createRentalRequestItemService } from "../domain/services/rentalRequestItemService";
import { createRentalRequestWorkflowService } from "../domain/services/rentalRequestWorkflowService";
import { rentalRequestItemFeatureFlags } from "../config/featureFlags";
import { publicSupabase, supabase } from "../lib/supabase";
import type { RentalRequestSubmission } from "../domain/models/rentalRequestWorkflow";

export const publicRentalRequestWorkflowService =
  createRentalRequestWorkflowService(
    createSupabaseRentalRequestWorkflowRepository(publicSupabase),
    rentalRequestItemFeatureFlags
  );

export const adminRentalRequestWorkflowService =
  createRentalRequestWorkflowService(
    createSupabaseRentalRequestWorkflowRepository(supabase),
    rentalRequestItemFeatureFlags
  );

export const adminRentalRequestItemService = createRentalRequestItemService(
  createSupabaseRentalRequestItemRepository(supabase),
  rentalRequestItemFeatureFlags
);

export const submitPublicMultiItemRentalRequest = async (
  submission: RentalRequestSubmission
) => {
  const prepared = publicRentalRequestWorkflowService.prepareRequest(submission);
  const result = await publicRentalRequestWorkflowService.createRequest(submission);
  const webhookUrl = import.meta.env.VITE_N8N_RENTAL_REQUEST_WEBHOOK;

  if (webhookUrl) {
    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rentalRequestId: result.rentalRequestId,
        fullName: prepared.request.fullName,
        businessName: prepared.request.businessName,
        customerType: prepared.request.customerType,
        phone: prepared.request.phone,
        email: prepared.request.email,
        equipmentRequested: prepared.legacyFields.equipment_requested,
        pickupDate: prepared.pickupDate,
        returnDate: prepared.returnDate,
        rentalDuration: prepared.rentalDuration,
        fulfillmentType: prepared.request.fulfillmentType,
        projectType: prepared.request.projectType,
        notes: prepared.request.notes,
        agreementAccepted: prepared.request.agreementAccepted,
        items: prepared.items.map((item) => ({
          equipmentId: item.equipmentId,
          equipmentName: item.equipmentName,
          startDate: item.startDate,
          endDate: item.endDate,
          quantity: item.quantity,
          dailyRate: item.dailyRate,
          notes: item.notes,
        })),
        status: "new",
        source: "website",
        submittedAt: new Date().toISOString(),
        eventType: "new_request",
      }),
    }).catch((error) => {
      console.error("MULTI-ITEM N8N WEBHOOK ERROR:", error);
    });
  }

  return result;
};
