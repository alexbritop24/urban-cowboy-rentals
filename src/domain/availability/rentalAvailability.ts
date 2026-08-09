const CALENDAR_DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})/;

const calendarDateKey = (value: string): string | null => {
  const directMatch = CALENDAR_DATE_PREFIX.exec(value);
  if (directMatch?.[1]) return directMatch[1];

  const parsed = Date.parse(value);
  return Number.isNaN(parsed)
    ? null
    : new Date(parsed).toISOString().slice(0, 10);
};

/**
 * Release 1 availability uses inclusive calendar-date ranges. Browser callers
 * use this only for immediate feedback; PostgreSQL remains authoritative.
 */
export const rentalDateRangesOverlapInclusive = (
  newStart: string,
  newEnd: string,
  existingStart: string,
  existingEnd: string
): boolean => {
  const newStartDate = calendarDateKey(newStart);
  const newEndDate = calendarDateKey(newEnd);
  const existingStartDate = calendarDateKey(existingStart);
  const existingEndDate = calendarDateKey(existingEnd);

  if (
    !newStartDate ||
    !newEndDate ||
    !existingStartDate ||
    !existingEndDate
  ) {
    return false;
  }

  return newStartDate <= existingEndDate && existingStartDate <= newEndDate;
};
