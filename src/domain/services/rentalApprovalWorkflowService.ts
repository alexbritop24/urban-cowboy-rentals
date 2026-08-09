import type {
  RentalApprovalActionResult,
  RentalApprovalChecklist,
  RentalApprovalCommand,
} from "../models/rentalApproval";
import type { RentalApprovalRepository } from "../models/rentalApprovalRepository";

const assertIdentifier = (value: string): void => {
  if (!value.trim()) throw new Error("Rental request ID is required.");
};

const normalizeCommand = (
  rentalRequestId: string,
  note: string | null
): RentalApprovalCommand => {
  assertIdentifier(rentalRequestId);
  const normalizedNote = note?.trim() || null;
  if (normalizedNote && normalizedNote.length > 2000) {
    throw new Error("Approval notes cannot exceed 2000 characters.");
  }
  return { rentalRequestId, note: normalizedNote };
};

export interface RentalApprovalWorkflowService {
  load(rentalRequestId: string): Promise<RentalApprovalChecklist>;
  confirmInitialAvailability(
    rentalRequestId: string,
    note: string | null
  ): Promise<RentalApprovalActionResult>;
  approve(
    rentalRequestId: string,
    note: string | null
  ): Promise<RentalApprovalActionResult>;
  reverse(
    rentalRequestId: string,
    note: string | null
  ): Promise<RentalApprovalActionResult>;
}

export const createRentalApprovalWorkflowService = (
  repository: RentalApprovalRepository
): RentalApprovalWorkflowService => ({
  async load(rentalRequestId) {
    assertIdentifier(rentalRequestId);
    return repository.loadChecklist(rentalRequestId);
  },

  confirmInitialAvailability(rentalRequestId, note) {
    return repository.confirmInitialAvailability(
      normalizeCommand(rentalRequestId, note)
    );
  },

  approve(rentalRequestId, note) {
    return repository.approve(normalizeCommand(rentalRequestId, note));
  },

  reverse(rentalRequestId, note) {
    return repository.reverse(normalizeCommand(rentalRequestId, note));
  },
});
