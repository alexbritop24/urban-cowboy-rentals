import type {
  RentalDocumentWorkflowState,
  ReviewRentalInsuranceCommand,
  UploadRentalDocumentCommand,
} from "./rentalDocument";

export interface RentalDocumentRepository {
  loadWorkflowState(
    rentalRequestId: string
  ): Promise<RentalDocumentWorkflowState>;
  upload(command: UploadRentalDocumentCommand): Promise<void>;
  createSignedViewUrl(documentId: string): Promise<string>;
  reviewInsurance(command: ReviewRentalInsuranceCommand): Promise<void>;
}
