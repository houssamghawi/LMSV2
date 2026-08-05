/**
 * Analytics data retention / soft archival (FR-022, research.md §5).
 * Standard dashboard queries exclude documents older than 24 months
 * and documents with archivedAt set. Compliance exports may include archived.
 */

import { getMaxLookbackDate } from "@/lib/analytics/date-ranges";
import type { DateRange } from "@/lib/analytics/date-ranges";

export const ANALYTICS_RETENTION_MONTHS = 24;

/** Soft-archive marker: null/missing = active in standard queries. */
export function notArchivedMatch(): { archivedAt: null } {
  return { archivedAt: null };
}

/** Spread into $match; empty when includeArchived (compliance export). */
export function archiveClause(
  includeArchived?: boolean
): Record<string, unknown> {
  return includeArchived ? {} : notArchivedMatch();
}

export type ArchiveQueryOptions = {
  includeArchived?: boolean;
};

/** Earliest date included in standard analytics windows. */
export function getRetentionCutoff(now: Date = new Date()): Date {
  return getMaxLookbackDate(now);
}

/**
 * Clamp a date range start to the retention window.
 * Does not mutate the input object.
 */
export function clampRangeToRetention(
  range: DateRange,
  now: Date = new Date()
): DateRange {
  const cutoff = getRetentionCutoff(now);
  const start = range.start < cutoff ? cutoff : range.start;
  return {
    ...range,
    start,
  };
}

/**
 * Merge retention + optional soft-archive exclusion into a Mongo $match fragment.
 * @param dateField - e.g. "paidAt", "enrollment_date", "createdAt", "timestamp"
 */
export function buildRetainedDateMatch(
  dateField: string,
  range: DateRange,
  options?: { includeArchived?: boolean; now?: Date }
): Record<string, unknown> {
  const clamped = clampRangeToRetention(range, options?.now);
  const match: Record<string, unknown> = {
    [dateField]: { $gte: clamped.start, $lte: clamped.end },
  };
  if (!options?.includeArchived) {
    Object.assign(match, notArchivedMatch());
  }
  return match;
}

/** True when a date falls outside the 24-month active window. */
export function isPastRetention(date: Date, now: Date = new Date()): boolean {
  return date.getTime() < getRetentionCutoff(now).getTime();
}
