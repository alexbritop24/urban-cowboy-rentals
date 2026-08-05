export type DomainValidationIssueCode =
  | "required"
  | "invalid_date"
  | "invalid_date_range"
  | "invalid_number"
  | "exceeds_balance"
  | "negative_amount"
  | "positive_integer_required"
  | "serialized_quantity_must_be_one"
  | "missing_serial_number"
  | "missing_lineage"
  | "empty_item_collection"
  | "duplicate_display_order"
  | "feature_configuration_error";

export interface DomainValidationIssue {
  code: DomainValidationIssueCode;
  path: string;
  message: string;
}

export class DomainValidationError extends Error {
  readonly issues: readonly DomainValidationIssue[];

  constructor(issues: readonly DomainValidationIssue[], message = "Domain validation failed.") {
    super(message);
    this.name = "DomainValidationError";
    this.issues = [...issues];
  }
}

export const assertNoValidationIssues = (
  issues: readonly DomainValidationIssue[],
  message?: string
): void => {
  if (issues.length > 0) {
    throw new DomainValidationError(issues, message);
  }
};
