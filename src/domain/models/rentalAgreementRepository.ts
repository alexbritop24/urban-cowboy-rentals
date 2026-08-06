import type {
  AgreementAcceptanceCommand,
  AgreementFinancialsCommand,
  RentalAgreementAggregate,
} from "./rentalAgreement";

export interface RentalAgreementRepository {
  findById(agreementId: string): Promise<RentalAgreementAggregate | null>;
  findByRentalRequestId(
    rentalRequestId: string
  ): Promise<RentalAgreementAggregate | null>;
  createForRentalRequest(rentalRequestId: string): Promise<string>;
  updateFinancials(command: AgreementFinancialsCommand): Promise<string>;
  recordAcceptance(command: AgreementAcceptanceCommand): Promise<string>;
  finalize(agreementId: string): Promise<string>;
}
