/** Exclude only explicitly classified tests; legacy/missing metadata stays visible.
 * Availability checks must continue using the full record collection.
 */
export function operationalDashboardRecords<T extends {is_test_data?: boolean | null}>(records: readonly T[]): T[] {
  return records.filter(record => record.is_test_data !== true);
}

/** Retain unlinked/system logs; hide only logs linked to explicitly classified tests. */
export function operationalAutomationLogs<T extends {rental_request_id: string | null}>(logs: readonly T[], excludedRequestIds: readonly string[]): T[] {
  const excluded = new Set(excludedRequestIds);
  return logs.filter(log => !log.rental_request_id || !excluded.has(log.rental_request_id));
}
