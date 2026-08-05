import type { Granularity } from "@/lib/analytics/schemas";

/** Mongo `$dateToString` format for trend buckets. */
export function dateBucketExpression(
  field: string,
  granularity: Granularity
): { $dateToString: { format: string; date: string } } {
  const format =
    granularity === "week"
      ? "%G-W%V"
      : granularity === "month"
        ? "%Y-%m"
        : "%Y-%m-%d";

  return {
    $dateToString: {
      format,
      date: `$${field}`,
    },
  };
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export function mapBucketRows(
  rows: Array<{ _id: string | null; value?: number; count?: number }>
): TimeSeriesPoint[] {
  return (rows || [])
    .filter((row) => row._id)
    .map((row) => ({
      date: String(row._id),
      value: row.value ?? row.count ?? 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
