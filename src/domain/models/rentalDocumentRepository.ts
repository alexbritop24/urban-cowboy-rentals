import type {
  RentalDocumentWorkflowState,
  ReviewRentalDriverLicenseCommand,
  ReviewRentalInsuranceCommand,
  UploadRentalDocumentCommand,
} from "./rentalDocument";

export interface RentalDocumentRepository {
  loadWorkflowState(
    rentalRequestId: string
  ): Promise<RentalDocumentWorkflowState>;
  upload(command: UploadRentalDocumentCommand): Promise<void>;
  createSignedViewUrl(documentId: string): Promise<string>;
  reviewDriverLicense(command: ReviewRentalDriverLicenseCommand): Promise<void>;
  reviewInsurance(command: ReviewRentalInsuranceCommand): Promise<void>;
}
