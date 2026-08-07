import {
  assertNoValidationIssues,
  type DomainValidationIssue,
} from "../errors/DomainValidationError";
import type { AgreementItem } from "../models/agreementItem";
import type { InvoiceItem } from "../models/invoiceItem";
import type { RentalItem } from "../models/rentalItem";
import type { RentalRequestItem } from "../models/rentalRequestItem";
import { parseRentalTemporal } from "../constants/rentalTime";

export interface ItemValidationOptions {
  requireSerialNumber?: boolean;
  requireNormalizedLineage?: boolean;
}

export const validateRequiredText = (
  value: string | null | undefined,
  path: string
): DomainValidationIssue[] =>
  value?.trim()
    ? []
    : [{ code: "required", path, message: `${path} is required.` }];

export const validatePositiveInteger = (
  value: number,
  path: string
): DomainValidationIssue[] =>
  Number.isInteger(value) && value > 0
    ? []
    : [
        {
          code: "positive_integer_required",
          path,
          message: `${path} must be a positive integer.`,
        },
      ];

export const validateNonNegativeAmount = (
  value: number,
  path: string
): DomainValidationIssue[] => {
  if (!Number.isFinite(value)) {
    return [
      {
        code: "invalid_number",
        path,
        message: `${path} must be a finite number.`,
      },
    ];
  }

  return value < 0
    ? [
        {
          code: "negative_amount",
          path,
          message: `${path} cannot be negative.`,
        },
      ]
    : [];
};

export const validateRentalPeriod = (
  startDate: string,
  endDate: string,
  path = "rentalPeriod"
): DomainValidationIssue[] => {
  const issues: DomainValidationIssue[] = [];
  const startTime = parseRentalTemporal(startDate);
  const endTime = parseRentalTemporal(endDate);

  if (!startDate || Number.isNaN(startTime)) {
    issues.push({
      code: "invalid_date",
      path: `${path}.startDate`,
      message: "A valid rental start date is required.",
    });
  }

  if (!endDate || Number.isNaN(endTime)) {
    issues.push({
      code: "invalid_date",
      path: `${path}.endDate`,
      message: "A valid rental end date is required.",
    });
  }

  if (issues.length === 0 && endTime < startTime) {
    issues.push({
      code: "invalid_date_range",
      path,
      message: "Rental end date cannot be before the start date.",
    });
  }

  return issues;
};

type ValidatableRentalItem = Omit<RentalItem, "quantity"> & {
  quantity: number | null;
};

const validateBaseItem = (
  item: ValidatableRentalItem,
  path: string,
  options: ItemValidationOptions
): DomainValidationIssue[] => {
  const quantityIssues =
    item.quantity === null
      ? [
          {
            code: "positive_integer_required",
            path: `${path}.quantity`,
            message: `${path}.quantity must be a positive integer.`,
          } satisfies DomainValidationIssue,
        ]
      : validatePositiveInteger(item.quantity, `${path}.quantity`);
  const issues: DomainValidationIssue[] = [
    ...validateRequiredText(item.id, `${path}.id`),
    ...validateRequiredText(item.equipmentName, `${path}.equipmentName`),
    ...quantityIssues,
    ...validateNonNegativeAmount(item.dailyRate, `${path}.dailyRate`),
    ...validateRentalPeriod(item.startDate, item.endDate, `${path}.rentalPeriod`),
  ];

  if (
    item.serialNumber?.trim() &&
    item.quantity !== null &&
    item.quantity !== 1
  ) {
    issues.push({
      code: "serialized_quantity_must_be_one",
      path: `${path}.quantity`,
      message: "A serialized equipment row must have quantity 1.",
    });
  }

  if (
    options.requireSerialNumber &&
    item.origin === "normalized" &&
    !item.serialNumber?.trim()
  ) {
    issues.push({
      code: "missing_serial_number",
      path: `${path}.serialNumber`,
      message: "A serial number is required for this item snapshot.",
    });
  }

  return issues;
};

const validateCollection = <TItem extends Pick<RentalItem, "displayOrder">>(
  items: readonly TItem[],
  validateItem: (item: TItem, path: string) => readonly DomainValidationIssue[]
): DomainValidationIssue[] => {
  if (items.length === 0) {
    return [
      {
        code: "empty_item_collection",
        path: "items",
        message: "At least one rental item is required.",
      },
    ];
  }

  const issues = items.flatMap((item, index) =>
    validateItem(item, `items[${index}]`)
  );
  const displayOrders = new Set<number>();

  items.forEach((item, index) => {
    if (displayOrders.has(item.displayOrder)) {
      issues.push({
        code: "duplicate_display_order",
        path: `items[${index}].displayOrder`,
        message: "Each item must have a unique display order.",
      });
    }
    displayOrders.add(item.displayOrder);
  });

  return issues;
};

export const validateRentalRequestItems = (
  items: readonly RentalRequestItem[],
  options: ItemValidationOptions = {}
): DomainValidationIssue[] =>
  validateCollection(items, (item, path) => [
    ...validateBaseItem(item, path, options),
    ...validateRequiredText(item.rentalRequestId, `${path}.rentalRequestId`),
  ]);

export const validateAgreementItems = (
  items: readonly AgreementItem[],
  options: ItemValidationOptions = {}
): DomainValidationIssue[] =>
  validateCollection(items, (item, path) => {
    const issues = [
      ...validateBaseItem(item, path, options),
      ...validateRequiredText(item.rentalAgreementId, `${path}.rentalAgreementId`),
      ...validatePositiveInteger(item.billableDays, `${path}.billableDays`),
      ...validateNonNegativeAmount(item.lineTotal, `${path}.lineTotal`),
    ];

    if (
      options.requireNormalizedLineage &&
      item.origin === "normalized" &&
      !item.rentalRequestItemId
    ) {
      issues.push({
        code: "missing_lineage",
        path: `${path}.rentalRequestItemId`,
        message: "A normalized agreement item must reference its request item.",
      });
    }

    return issues;
  });

export const validateInvoiceItems = (
  items: readonly InvoiceItem[],
  options: ItemValidationOptions = {}
): DomainValidationIssue[] =>
  validateCollection(items, (item, path) => {
    const issues = [
      ...validateBaseItem(item, path, options),
      ...validateRequiredText(item.invoiceId, `${path}.invoiceId`),
      ...validatePositiveInteger(item.billableDays, `${path}.billableDays`),
      ...validateNonNegativeAmount(item.lineTotal, `${path}.lineTotal`),
    ];

    if (
      options.requireNormalizedLineage &&
      item.origin === "normalized" &&
      !item.agreementItemId
    ) {
      issues.push({
        code: "missing_lineage",
        path: `${path}.agreementItemId`,
        message: "A normalized invoice item must reference its agreement item.",
      });
    }

    return issues;
  });

export const assertValidRentalRequestItems = (
  items: readonly RentalRequestItem[],
  options?: ItemValidationOptions
): void =>
  assertNoValidationIssues(
    validateRentalRequestItems(items, options),
    "Rental request item validation failed."
  );

export const assertValidAgreementItems = (
  items: readonly AgreementItem[],
  options?: ItemValidationOptions
): void =>
  assertNoValidationIssues(
    validateAgreementItems(items, options),
    "Agreement item validation failed."
  );

export const assertValidInvoiceItems = (
  items: readonly InvoiceItem[],
  options?: ItemValidationOptions
): void =>
  assertNoValidationIssues(
    validateInvoiceItems(items, options),
    "Invoice item validation failed."
  );
