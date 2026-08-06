import { adaptLegacyAgreementItem } from "../adapters/legacyItemAdapters";
import { assertNoValidationIssues } from "../errors/DomainValidationError";
import type {
  AgreementAcceptanceCommand,
  AgreementFinancialsCommand,
  RentalAgreementAggregate,
} from "../models/rentalAgreement";
import type { RentalAgreementRepository } from "../models/rentalAgreementRepository";
import { validateNonNegativeAmount } from "../validators/rentalItemValidators";

const assertIdentifier = (value: string, path: string): void => {
  if (!value.trim()) {
    throw new Error(`${path} is required.`);
  }
};

const withLegacyItemFallback = (
  aggregate: RentalAgreementAggregate
): RentalAgreementAggregate => {
  if (aggregate.items.length > 0) return aggregate;

  const { agreement } = aggregate;
  return {
    agreement,
    items: [
      adaptLegacyAgreementItem(
        agreement.id,
        {
          equipment_requested: agreement.equipmentRequested,
          rental_start_date: agreement.rentalStartDate,
          rental_end_date: agreement.rentalEndDate,
        },
        {
          dailyRate: 0,
          lineTotal: agreement.quoteAmount,
        }
      ),
    ],
  };
};

export interface RentalAgreementWorkflowService {
  loadAgreement(agreementId: string): Promise<RentalAgreementAggregate | null>;
  getByRentalRequestId(
    rentalRequestId: string
  ): Promise<RentalAgreementAggregate | null>;
  createOrOpen(rentalRequestId: string): Promise<RentalAgreementAggregate>;
  updateFinancials(
    command: AgreementFinancialsCommand
  ): Promise<RentalAgreementAggregate>;
  recordAcceptance(
    command: AgreementAcceptanceCommand
  ): Promise<RentalAgreementAggregate>;
  finalize(agreementId: string): Promise<RentalAgreementAggregate>;
}

const requireAggregate = async (
  repository: RentalAgreementRepository,
  agreementId: string
): Promise<RentalAgreementAggregate> => {
  const aggregate = await repository.findById(agreementId);
  if (!aggregate) throw new Error("Rental Agreement not found.");
  return withLegacyItemFallback(aggregate);
};

export const createRentalAgreementWorkflowService = (
  repository: RentalAgreementRepository
): RentalAgreementWorkflowService => ({
  async loadAgreement(agreementId) {
    assertIdentifier(agreementId, "Agreement ID");
    const aggregate = await repository.findById(agreementId);
    return aggregate ? withLegacyItemFallback(aggregate) : null;
  },

  async getByRentalRequestId(rentalRequestId) {
    assertIdentifier(rentalRequestId, "Rental request ID");
    const aggregate = await repository.findByRentalRequestId(rentalRequestId);
    return aggregate ? withLegacyItemFallback(aggregate) : null;
  },

  async createOrOpen(rentalRequestId) {
    assertIdentifier(rentalRequestId, "Rental request ID");
    const existing = await repository.findByRentalRequestId(rentalRequestId);
    if (existing) return withLegacyItemFallback(existing);

    const agreementId = await repository.createForRentalRequest(rentalRequestId);
    return requireAggregate(repository, agreementId);
  },

  async updateFinancials(command) {
    assertIdentifier(command.agreementId, "Agreement ID");
    assertNoValidationIssues([
      ...validateNonNegativeAmount(command.depositAmount, "depositAmount"),
      ...validateNonNegativeAmount(command.deliveryFee, "deliveryFee"),
      ...validateNonNegativeAmount(command.taxAmount, "taxAmount"),
    ]);
    const agreementId = await repository.updateFinancials(command);
    return requireAggregate(repository, agreementId);
  },

  async recordAcceptance(command) {
    assertIdentifier(command.agreementId, "Agreement ID");
    const signerName = command.signerLegalName.trim();
    if (!signerName || signerName.length > 200) {
      throw new Error("A valid signer legal name is required.");
    }
    if (!command.agreementAccepted) {
      throw new Error("The signer must explicitly accept the Agreement.");
    }
    if (!command.creditCardAuthorizationAcknowledged) {
      throw new Error("Credit-card authorization acknowledgment is required.");
    }
    const agreementId = await repository.recordAcceptance({
      ...command,
      signerLegalName: signerName,
      signerTitle: command.signerTitle?.trim() || null,
    });
    return requireAggregate(repository, agreementId);
  },

  async finalize(agreementId) {
    assertIdentifier(agreementId, "Agreement ID");
    const finalizedId = await repository.finalize(agreementId);
    return requireAggregate(repository, finalizedId);
  },
});
