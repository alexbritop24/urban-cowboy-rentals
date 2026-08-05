import {
  DEFAULT_RENTAL_DAY_POLICY,
  type RentalDayPolicy,
} from "../constants/rentalDefaults";
import { MILLISECONDS_PER_DAY, parseRentalTemporal } from "../constants/rentalTime";
import { assertNoValidationIssues } from "../errors/DomainValidationError";
import {
  validateNonNegativeAmount,
  validatePositiveInteger,
  validateRentalPeriod,
} from "../validators/rentalItemValidators";

const CURRENCY_SCALE = 100;

export interface CalculateRentalDaysOptions {
  policy?: RentalDayPolicy;
}

export interface InvoiceTotalInput {
  subtotal: number;
  depositAmount?: number;
  deliveryFee?: number;
  taxAmount?: number;
}

export interface BalanceDueOptions {
  minimumZero?: boolean;
}

export interface RentalPricingItemInput {
  startDate: string;
  endDate: string;
  quantity: number;
  dailyRate: number;
}

export interface RentalItemPricingResult {
  billableDays: number;
  lineTotal: number;
}

export const roundCurrency = (value: number): number =>
  Math.round((value + Number.EPSILON) * CURRENCY_SCALE) / CURRENCY_SCALE;

export const calculateRentalDays = (
  startDate: string,
  endDate: string,
  options: CalculateRentalDaysOptions = {}
): number => {
  assertNoValidationIssues(validateRentalPeriod(startDate, endDate));

  const startTime = parseRentalTemporal(startDate);
  const endTime = parseRentalTemporal(endDate);
  const elapsedDays = (endTime - startTime) / MILLISECONDS_PER_DAY;
  const policy = options.policy ?? DEFAULT_RENTAL_DAY_POLICY;

  if (policy === "calendar-days-inclusive") {
    return Math.floor(elapsedDays) + 1;
  }

  return Math.max(1, Math.ceil(elapsedDays));
};

export const calculateLineTotal = (
  dailyRate: number,
  billableDays: number,
  quantity = 1
): number => {
  assertNoValidationIssues([
    ...validateNonNegativeAmount(dailyRate, "dailyRate"),
    ...validatePositiveInteger(billableDays, "billableDays"),
    ...validatePositiveInteger(quantity, "quantity"),
  ]);

  return roundCurrency(dailyRate * billableDays * quantity);
};

export const calculateRentalItemPricing = (
  item: RentalPricingItemInput
): RentalItemPricingResult => {
  const billableDays = calculateRentalDays(item.startDate, item.endDate);
  return {
    billableDays,
    lineTotal: calculateLineTotal(
      item.dailyRate,
      billableDays,
      item.quantity
    ),
  };
};

export const calculateSubtotal = (
  lineItems: readonly { lineTotal: number }[]
): number => {
  const issues = lineItems.flatMap((item, index) =>
    validateNonNegativeAmount(item.lineTotal, `lineItems[${index}].lineTotal`)
  );
  assertNoValidationIssues(issues);

  return roundCurrency(
    lineItems.reduce((subtotal, item) => subtotal + item.lineTotal, 0)
  );
};

export const calculateRentalItemsSubtotal = (
  items: readonly RentalPricingItemInput[]
): number => calculateSubtotal(items.map(calculateRentalItemPricing));

export const calculateTax = (taxableAmount: number, taxRate: number): number => {
  assertNoValidationIssues([
    ...validateNonNegativeAmount(taxableAmount, "taxableAmount"),
    ...validateNonNegativeAmount(taxRate, "taxRate"),
  ]);

  return roundCurrency(taxableAmount * taxRate);
};

export const calculateInvoiceTotal = ({
  subtotal,
  depositAmount = 0,
  deliveryFee = 0,
  taxAmount = 0,
}: InvoiceTotalInput): number => {
  assertNoValidationIssues([
    ...validateNonNegativeAmount(subtotal, "subtotal"),
    ...validateNonNegativeAmount(depositAmount, "depositAmount"),
    ...validateNonNegativeAmount(deliveryFee, "deliveryFee"),
    ...validateNonNegativeAmount(taxAmount, "taxAmount"),
  ]);

  // Preserve the current application's exact summary arithmetic. Line and tax
  // calculations are rounded independently; Sprint 2B must approve any change
  // to the stored summary-value rounding policy.
  return subtotal + depositAmount + deliveryFee + taxAmount;
};

export const calculateBalanceDue = (
  totalAmount: number,
  amountPaid: number,
  options: BalanceDueOptions = {}
): number => {
  assertNoValidationIssues([
    ...validateNonNegativeAmount(totalAmount, "totalAmount"),
    ...validateNonNegativeAmount(amountPaid, "amountPaid"),
  ]);

  const balanceDue = totalAmount - amountPaid;
  return options.minimumZero ? Math.max(balanceDue, 0) : balanceDue;
};
