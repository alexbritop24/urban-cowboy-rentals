import { createSupabaseRentalDocumentRepository } from "../domain/adapters/supabaseRentalDocumentRepository";
import type {
  RentalDocumentType,
  RentalDocumentWorkflowState,
} from "../domain/models/rentalDocument";
import { createRentalDocumentWorkflowService } from "../domain/services/rentalDocumentWorkflowService";
import { supabase } from "../lib/supabase";

const workflow = createRentalDocumentWorkflowService(
  createSupabaseRentalDocumentRepository(supabase)
);

const toDomainFile = (file: File) => ({
  name: file.name,
  type: file.type,
  size: file.size,
  source: file,
  readSignature: async () =>
    new Uint8Array(await file.slice(0, 8).arrayBuffer()),
});

export const loadRentalDocumentWorkflow = (
  rentalRequestId: string
): Promise<RentalDocumentWorkflowState> => workflow.load(rentalRequestId);

export const uploadRentalDocument = (
  rentalRequestId: string,
  documentType: RentalDocumentType,
  file: File
): Promise<RentalDocumentWorkflowState> =>
  workflow.upload(rentalRequestId, documentType, toDomainFile(file));

export const createRentalDocumentViewUrl = (
  documentId: string
): Promise<string> => workflow.createSignedViewUrl(documentId);

export const reviewRentalInsurance = (
  rentalRequestId: string,
  status: "verified" | "rejected",
  note: string | null
): Promise<RentalDocumentWorkflowState> =>
  workflow.reviewInsurance({ rentalRequestId, status, note });
