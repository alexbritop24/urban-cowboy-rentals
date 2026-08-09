import type {
  RentalDocumentFile,
  RentalDocumentType,
  RentalDocumentWorkflowState,
  ReviewRentalInsuranceCommand,
} from "../models/rentalDocument";
import type { RentalDocumentRepository } from "../models/rentalDocumentRepository";
import { validateRentalDocumentFile } from "../validators/rentalDocumentValidators";

const assertIdentifier = (value: string, label: string): void => {
  if (!value.trim()) throw new Error(`${label} is required.`);
};

export interface RentalDocumentWorkflowService {
  load(rentalRequestId: string): Promise<RentalDocumentWorkflowState>;
  upload(
    rentalRequestId: string,
    documentType: RentalDocumentType,
    file: RentalDocumentFile
  ): Promise<RentalDocumentWorkflowState>;
  createSignedViewUrl(documentId: string): Promise<string>;
  reviewInsurance(
    command: ReviewRentalInsuranceCommand
  ): Promise<RentalDocumentWorkflowState>;
}

export const createRentalDocumentWorkflowService = (
  repository: RentalDocumentRepository
): RentalDocumentWorkflowService => ({
  async load(rentalRequestId) {
    assertIdentifier(rentalRequestId, "Rental request ID");
    return repository.loadWorkflowState(rentalRequestId);
  },

  async upload(rentalRequestId, documentType, file) {
    assertIdentifier(rentalRequestId, "Rental request ID");
    const normalizedFilename = await validateRentalDocumentFile(file);
    await repository.upload({
      rentalRequestId,
      documentType,
      file: { ...file, name: normalizedFilename },
    });
    return repository.loadWorkflowState(rentalRequestId);
  },

  async createSignedViewUrl(documentId) {
    assertIdentifier(documentId, "Document ID");
    const url = await repository.createSignedViewUrl(documentId);
    if (!url) throw new Error("A temporary document URL could not be generated.");
    return url;
  },

  async reviewInsurance(command) {
    assertIdentifier(command.rentalRequestId, "Rental request ID");
    const note = command.note?.trim() || null;
    if (note && note.length > 2000) {
      throw new Error("Insurance review note cannot exceed 2000 characters.");
    }
    await repository.reviewInsurance({ ...command, note });
    return repository.loadWorkflowState(command.rentalRequestId);
  },
});
