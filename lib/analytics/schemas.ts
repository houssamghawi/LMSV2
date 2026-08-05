import { z } from "zod";

/** Accepts ISO date (`YYYY-MM-DD`) or full ISO datetime strings. */
const isoDateString = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid ISO date",
  });

const MAX_RANGE_MS = 24 * 30 * 24 * 60 * 60 * 1000; // ~24 months

function rangeWithinLimit(startDate?: string, endDate?: string): boolean {
  if (!startDate || !endDate) return true;
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return false;
  return end - start <= MAX_RANGE_MS;
}

export const dateRangeSchema = z
  .object({
    startDate: isoDateString.optional(),
    endDate: isoDateString.optional(),
  })
  .refine((data) => rangeWithinLimit(data.startDate, data.endDate), {
    message: "Date range cannot exceed 24 months",
  })
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) return true;
      return new Date(data.endDate).getTime() >= new Date(data.startDate).getTime();
    },
    { message: "endDate must be on or after startDate" }
  );

export const granularitySchema = z.enum(["day", "week", "month"]).default("day");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(50),
});

export const exportRequestSchema = z.object({
  section: z.enum([
    "users",
    "courses",
    "revenue",
    "enrollments",
    "activity",
    "students",
  ]),
  startDate: isoDateString,
  endDate: isoDateString,
  courseId: z.string().optional(),
  includeArchived: z.boolean().optional().default(false),
}).refine((data) => rangeWithinLimit(data.startDate, data.endDate), {
  message: "Date range cannot exceed 24 months",
});

export const trendDirectionSchema = z.enum(["up", "down", "stable"]);

export const trendIndicatorSchema = z.object({
  current: z.number(),
  previous: z.number(),
  changePercent: z.number(),
  direction: trendDirectionSchema,
});

export const anomalySeveritySchema = z.enum(["critical", "warning", "info"]);

export const anomalyResultSchema = z.object({
  metric: z.string(),
  detected: z.boolean(),
  severity: anomalySeveritySchema,
  currentValue: z.number(),
  expectedValue: z.number(),
  threshold: z.number(),
  changePercent: z.number(),
  message: z.string(),
});

export const timeSeriesPointSchema = z.object({
  date: z.string(),
  value: z.number(),
});

export const platformOverviewSchema = z.object({
  totalCourses: z.number(),
  activeCourses: z.number(),
  totalUsers: z.number(),
  totalStudents: z.number(),
  totalInstructors: z.number(),
  totalRevenue: z.number(),
  totalEnrollments: z.number(),
  activeUsersToday: z.number(),
  trends: z.object({
    courses: trendIndicatorSchema,
    users: trendIndicatorSchema,
    revenue: trendIndicatorSchema,
    enrollments: trendIndicatorSchema,
  }),
  anomalies: z.array(anomalyResultSchema).optional().default([]),
});

export const analyticsDateRangeResponseSchema = z.object({
  start: z.string(),
  end: z.string(),
});

export const analyticsSuccessSchema = z.object({
  success: z.literal(true),
  data: z.unknown(),
  dateRange: analyticsDateRangeResponseSchema.optional(),
});

export type DateRangeQuery = z.infer<typeof dateRangeSchema>;
export type PaginationQuery = z.infer<typeof paginationSchema>;
export type ExportRequest = z.infer<typeof exportRequestSchema>;
export type TrendIndicator = z.infer<typeof trendIndicatorSchema>;
export type AnomalyResult = z.infer<typeof anomalyResultSchema>;
export type PlatformOverview = z.infer<typeof platformOverviewSchema>;
export type Granularity = z.infer<typeof granularitySchema>;
