import { rentalRequestDraftsToItems } from "../adapters/rentalRequestDraftAdapters";
import { rentalRequestItemsToLegacyFields } from "../adapters/legacyItemAdapters";
import { DomainValidationError } from "../errors/DomainValidationError";
import {
  multiItemFeatureFlags,
  type MultiItemFeatureFlags,
} from "../featureFlags/multiItemFeatureFlags";
import type {
  PreparedRentalRequestCommand,
  RentalRequestCreationResult,
  RentalRequestSubmission,
  ReplaceRentalRequestItemsCommand,
  RentalRequestItemDraft,
} from "../models/rentalRequestWorkflow";
import type { RentalRequestWorkflowRepository } from "../models/rentalRequestWorkflowRepository";
import {
  calculateLineTotal,
  calculateRentalDays,
  calculateSubtotal,
} from "../pricing/rentalPricing";
import {
  assertValidRentalRequestSubmission,
  validateRentalRequestItemDrafts,
} from "../validators/rentalRequestWorkflowValidators";
import { assertNoValidationIssues } from "../errors/DomainValidationError";

const TEMPORARY_REQUEST_ID = "pending-rental-request";

const getScheduleBounds = (
  items: readonly RentalRequestItemDraft[]
): { pickupDate: string; returnDate: string } => {
  const pickupDate = [...items].map((item) => item.startDate).sort()[0] ?? "";
  const returnDate = [...items].map((item) => item.endDate).sort().at(-1) ?? "";
  return { pickupDate, returnDate };
};

const getRentalDuration = (items: readonly RentalRequestItemDraft[]): string => {
  if (items.length !== 1) {
    return `${items.length} independently scheduled items`;
  }

  const item = items[0];
  if (!item) return "";
  const days = calculateRentalDays(item.startDate, item.endDate);
  return `${days} day${days === 1 ? "" : "s"}`;
};

const getEstimatedSubtotal = (
  items: readonly RentalRequestItemDraft[]
): number =>
  calculateSubtotal(
    items.map((item) => {
      const days = calculateRentalDays(item.startDate, item.endDate);
      return {
        lineTotal: calculateLineTotal(item.dailyRate, days, item.quantity),
      };
    })
  );

const assertWriteFeature = (
  repository: RentalRequestWorkflowRepository | undefined,
  flags: Readonly<MultiItemFeatureFlags>
): RentalRequestWorkflowRepository => {
  if (!flags.writeNormalizedItems || !repository) {
    throw new DomainValidationError(
      [
        {
          code: "feature_configuration_error",
          path: "multiItemRentalRequests",
          message:
            "Multi-item request persistence is disabled or not configured.",
        },
      ],
      "Multi-item requests are not enabled."
    );
  }

  return repository;
};

const prepareItems = (
  drafts: readonly RentalRequestItemDraft[],
  rentalRequestId: string
): Omit<ReplaceRentalRequestItemsCommand, "rentalRequestId"> => {
  assertNoValidationIssues(
    validateRentalRequestItemDrafts(drafts),
    "Rental request item validation failed."
  );

  const items = rentalRequestDraftsToItems(drafts, rentalRequestId);
  const { pickupDate, returnDate } = getScheduleBounds(drafts);

  return {
    items,
    legacyFields: rentalRequestItemsToLegacyFields(items),
    pickupDate,
    returnDate,
    rentalDuration: getRentalDuration(drafts),
    estimatedSubtotal: getEstimatedSubtotal(drafts),
  };
};

export interface RentalRequestWorkflowService {
  createRequest(
    submission: RentalRequestSubmission
  ): Promise<RentalRequestCreationResult>;
  replaceItems(
    rentalRequestId: string,
    drafts: readonly RentalRequestItemDraft[]
  ): Promise<void>;
  prepareRequest(submission: RentalRequestSubmission): PreparedRentalRequestCommand;
}

const prepareRequest = (
  submission: RentalRequestSubmission
): PreparedRentalRequestCommand => {
  assertValidRentalRequestSubmission(submission);
  const preparedItems = prepareItems(submission.items, TEMPORARY_REQUEST_ID);

  return {
    request: {
      customerType: submission.customerType,
      fullName: submission.fullName.trim(),
      businessName: submission.businessName.trim(),
      phone: submission.phone.replace(/\D/g, ""),
      email: submission.email.trim(),
      fulfillmentType: submission.fulfillmentType,
      projectType: submission.projectType.trim(),
      notes: submission.notes.trim(),
      agreementAccepted: submission.agreementAccepted,
    },
    ...preparedItems,
  };
};

export const createRentalRequestWorkflowService = (
  repository?: RentalRequestWorkflowRepository,
  flags: Readonly<MultiItemFeatureFlags> = multiItemFeatureFlags
): RentalRequestWorkflowService => ({
  prepareRequest,

  async createRequest(submission) {
    const enabledRepository = assertWriteFeature(repository, flags);
    return enabledRepository.createWithItems(prepareRequest(submission));
  },

  async replaceItems(rentalRequestId, drafts) {
    const enabledRepository = assertWriteFeature(repository, flags);
    const preparedItems = prepareItems(drafts, rentalRequestId);
    await enabledRepository.replaceItems({ rentalRequestId, ...preparedItems });
  },
});
