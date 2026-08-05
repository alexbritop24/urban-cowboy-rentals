export const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const parseRentalTemporal = (value: string): number => {
  const normalizedValue = DATE_ONLY_PATTERN.test(value)
    ? `${value}T00:00:00.000Z`
    : value;

  return Date.parse(normalizedValue);
};
