import type {
  PreparedRentalRequestCommand,
  RentalRequestCreationResult,
  RentalRequestItemEditability,
  ReplaceRentalRequestItemsCommand,
} from "./rentalRequestWorkflow";

export interface RentalRequestWorkflowRepository {
  createWithItems(
    command: PreparedRentalRequestCommand
  ): Promise<RentalRequestCreationResult>;
  replaceItems(command: ReplaceRentalRequestItemsCommand): Promise<void>;
  getEditability(
    rentalRequestId: string
  ): Promise<RentalRequestItemEditability>;
}
