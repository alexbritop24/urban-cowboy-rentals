import { rentalRequestDraftsToItems } from "../adapters/rentalRequestDraftAdapters";
import {
  assertNoValidationIssues,
  type DomainValidationIssue,
} from "../errors/DomainValidationError";
import type {
  RentalRequestItemDraft,
  RentalRequestSubmission,
} from "../models/rentalRequestWorkflow";
import {
  validateRentalRequestItems,
  validateRequiredText,
} from "./rentalItemValidators";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateRentalRequestItemDrafts = (
  drafts: readonly RentalRequestItemDraft[]
): DomainValidationIssue[] =>
  validateRentalRequestItems(
    rentalRequestDraftsToItems(drafts, "pending-rental-request")
  );

export const validateRentalRequestSubmission = (
  submission: RentalRequestSubmission
): DomainValidationIssue[] => {
  const issues: DomainValidationIssue[] = [
    ...validateRequiredText(submission.fullName, "fullName"),
    ...validateRequiredText(submission.phone, "phone"),
    ...validateRequiredText(submission.email, "email"),
    ...validateRequiredText(submission.fulfillmentType, "fulfillmentType"),
    ...validateRentalRequestItemDrafts(submission.items),
  ];

  if (submission.customerType === "business") {
    issues.push(...validateRequiredText(submission.businessName, "businessName"));
  }

  if (submission.email && !EMAIL_PATTERN.test(submission.email)) {
    issues.push({
      code: "invalid_format",
      path: "email",
      message: "Enter a valid email address.",
    });
  }

  if (!submission.agreementAccepted) {
    issues.push({
      code: "required",
      path: "agreementAccepted",
      message: "Request acknowledgement is required.",
    });
  }

  return issues;
};

export const assertValidRentalRequestSubmission = (
  submission: RentalRequestSubmission
): void =>
  assertNoValidationIssues(
    validateRentalRequestSubmission(submission),
    "Rental request validation failed."
  );
