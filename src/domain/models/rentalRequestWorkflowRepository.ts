import type {
  PreparedRentalRequestCommand,
  RentalRequestCreationResult,
  ReplaceRentalRequestItemsCommand,
} from "./rentalRequestWorkflow";

export interface RentalRequestWorkflowRepository {
  createWithItems(
    command: PreparedRentalRequestCommand
  ): Promise<RentalRequestCreationResult>;
  replaceItems(command: ReplaceRentalRequestItemsCommand): Promise<void>;
}
