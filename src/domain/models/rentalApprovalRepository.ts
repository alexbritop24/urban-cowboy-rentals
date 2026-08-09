import type {
  RentalApprovalActionResult,
  RentalApprovalChecklist,
  RentalApprovalCommand,
} from "./rentalApproval";

export interface RentalApprovalRepository {
  loadChecklist(rentalRequestId: string): Promise<RentalApprovalChecklist>;
  confirmInitialAvailability(
    command: RentalApprovalCommand
  ): Promise<RentalApprovalActionResult>;
  approve(command: RentalApprovalCommand): Promise<RentalApprovalActionResult>;
  reverse(command: RentalApprovalCommand): Promise<RentalApprovalActionResult>;
}
