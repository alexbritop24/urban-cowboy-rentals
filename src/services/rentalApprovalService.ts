import { createSupabaseRentalApprovalRepository } from "../domain/adapters/supabaseRentalApprovalRepository";
import type {
  RentalApprovalActionResult,
  RentalApprovalChecklist,
} from "../domain/models/rentalApproval";
import { createRentalApprovalWorkflowService } from "../domain/services/rentalApprovalWorkflowService";
import { supabase } from "../lib/supabase";

const workflow = createRentalApprovalWorkflowService(
  createSupabaseRentalApprovalRepository(supabase)
);

export const loadRentalApprovalChecklist = (
  rentalRequestId: string
): Promise<RentalApprovalChecklist> => workflow.load(rentalRequestId);

export const confirmInitialRentalAvailability = (
  rentalRequestId: string,
  note: string | null
): Promise<RentalApprovalActionResult> =>
  workflow.confirmInitialAvailability(rentalRequestId, note);

export const approveRentalRequest = (
  rentalRequestId: string,
  note: string | null
): Promise<RentalApprovalActionResult> => workflow.approve(rentalRequestId, note);

export const reverseRentalApproval = (
  rentalRequestId: string,
  note: string | null
): Promise<RentalApprovalActionResult> => workflow.reverse(rentalRequestId, note);
