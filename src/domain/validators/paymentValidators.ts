import {
  assertNoValidationIssues,
  type DomainValidationIssue,
} from "../errors/DomainValidationError";
import { validateNonNegativeAmount } from "./rentalItemValidators";

export const validatePaymentAmount = (
  amount: number,
  balanceDue?: number
): DomainValidationIssue[] => {
  const issues: DomainValidationIssue[] = [];

  if (!Number.isFinite(amount) || amount <= 0) {
    issues.push({
      code: "invalid_number",
      path: "amount",
      message: "Payment amount must be greater than zero.",
    });
  }

  if (balanceDue === undefined) {
    return issues;
  }

  issues.push(...validateNonNegativeAmount(balanceDue, "balanceDue"));

  if (issues.length === 0 && amount > balanceDue) {
    issues.push({
      code: "exceeds_balance",
      path: "amount",
      message: `Payment cannot exceed the remaining balance of $${balanceDue.toFixed(
        2
      )}.`,
    });
  }

  return issues;
};

export const assertValidPaymentAmount = (
  amount: number,
  balanceDue?: number
): void => {
  const issues = validatePaymentAmount(amount, balanceDue);
  assertNoValidationIssues(issues, issues[0]?.message);
};
