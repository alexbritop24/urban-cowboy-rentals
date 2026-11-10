const mountainOffset = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Denver",
  timeZoneName: "longOffset",
});

const getOffset = (timestamp: number) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return undefined;

  return mountainOffset.formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value.slice(3);
};

export const mountainBookingDateTimeToIso = (dateTime: string): string | null => {
  if (!dateTime) return null;

  const wallTime = Date.parse(`${dateTime}Z`);
  if (Number.isNaN(wallTime)) return null;

  // Check both sides of a possible clock change. For a repeated time, use
  // its first occurrence. A skipped time has no matching offset.
  const day = 24 * 60 * 60 * 1000;
  const offsets = new Set([getOffset(wallTime - day), getOffset(wallTime + day)]);
  for (const offset of offsets) {
    if (!offset) continue;
    const timestamp = Date.parse(`${dateTime}${offset}`);
    if (getOffset(timestamp) === offset) return new Date(timestamp).toISOString();
  }

  return null;
};
