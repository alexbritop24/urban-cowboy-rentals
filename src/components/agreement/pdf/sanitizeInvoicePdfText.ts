export const invoicePdfRedactionLabel = "[REDACTED]";

const cardNumberCandidate = /(^|[^\d])((?:\d[ -]?){12,18}\d)(?!\d)/g;
const labeledSecurityCode =
  /\b(CVV2?|CVC2?|security[ -]?code)\b([ \t]*(?:(?::|=)|(?:is|was)|(?:value(?:[ \t]+is)?))?[ \t]*)(\d{3,4})\b/gi;

const passesLuhnCheck = (candidate: string): boolean => {
  const digits = candidate.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let doubleDigit = false;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }

  return sum % 10 === 0;
};

export const sanitizeInvoicePdfText = (value: string): string =>
  value
    .replace(
      labeledSecurityCode,
      (_match, label: string, separator: string) =>
        `${label}${separator}${invoicePdfRedactionLabel}`
    )
    .replace(
      cardNumberCandidate,
      (match, prefix: string, candidate: string) =>
        passesLuhnCheck(candidate)
          ? `${prefix}${invoicePdfRedactionLabel}`
          : match
    );
