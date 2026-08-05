import "server-only";
import { formatISO } from "date-fns";
import type { DateRange } from "@/lib/analytics/date-ranges";
import { resolveDateRange } from "@/lib/analytics/date-ranges";
import { isAdmin, isInstructor } from "@/lib/authorization";
import {
  getActiveUsersTrend,
  getRegistrationTrend,
} from "@/queries/analytics/user-aggregations";
import {
  getEnrollmentTrend,
  getTopCoursesByPerformance,
} from "@/queries/analytics/course-aggregations";
import {
  getRevenueTrend,
  getInstructorEarningsByCourse,
  getInstructorEarningsTrend,
} from "@/queries/analytics/revenue-aggregations";
import {
  getActivityByHour,
  getInstructorActivityTrend,
} from "@/queries/analytics/activity-aggregations";
import { getCourseStudentProgress } from "@/queries/analytics/progress-aggregations";
import { fillDailySeries } from "@/service/analytics/projection.service";

/** Max rows per export (research.md §6). */
export const MAX_EXPORT_ROWS = 100_000;

export const ADMIN_EXPORT_SECTIONS = [
  "users",
  "courses",
  "revenue",
  "enrollments",
  "activity",
] as const;

export const INSTRUCTOR_EXPORT_SECTIONS = [
  "students",
  "activity",
  "revenue",
] as const;

export type ExportSection =
  | (typeof ADMIN_EXPORT_SECTIONS)[number]
  | (typeof INSTRUCTOR_EXPORT_SECTIONS)[number];

export class ExportError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ExportError";
    this.status = status;
    this.code = code;
  }
}

export interface ExportRequestOptions {
  user: { id: string; role: string };
  /** Effective instructor id for instructor-scoped sections (may differ for admin). */
  instructorId?: string;
  section: ExportSection;
  startDate: string;
  endDate: string;
  courseId?: string;
  /** When true, include soft-archived rows (FR-022 compliance export). */
  includeArchived?: boolean;
}

export interface ExportResult {
  filename: string;
  rowCount: number;
  csv: string;
}

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(
  headers: string[],
  rows: Array<Array<string | number | null>>
): string {
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ];
  return lines.join("\n") + "\n";
}

function filenameFor(section: string, endDate: string): string {
  const day = endDate.slice(0, 10);
  return `analytics-${section}-${day}.csv`;
}

function enforceRowCap(rowCount: number): void {
  if (rowCount > MAX_EXPORT_ROWS) {
    throw new ExportError(
      400,
      "EXPORT_TOO_LARGE",
      `Export exceeds the maximum of ${MAX_EXPORT_ROWS} rows. Narrow the date range.`
    );
  }
}

/**
 * Decide admin platform vs instructor-scoped export.
 * Shared section names (activity, revenue): admin without courseId → platform;
 * with courseId or instructor role → instructor scope.
 */
export function resolveExportScope(
  user: { role: string },
  section: ExportSection,
  courseId?: string
): "admin" | "instructor" {
  if (section === "students") {
    if (!isInstructor(user) && !isAdmin(user)) {
      throw new ExportError(403, "FORBIDDEN", "Forbidden");
    }
    return "instructor";
  }

  if (
    section === "users" ||
    section === "courses" ||
    section === "enrollments"
  ) {
    if (!isAdmin(user)) {
      throw new ExportError(403, "FORBIDDEN", "Forbidden");
    }
    return "admin";
  }

  if (section === "activity" || section === "revenue") {
    if (isAdmin(user) && !courseId) return "admin";
    if (isInstructor(user) || isAdmin(user)) return "instructor";
    throw new ExportError(403, "FORBIDDEN", "Forbidden");
  }

  throw new ExportError(400, "VALIDATION_ERROR", `Unknown section: ${section}`);
}

async function exportAdminUsers(range: DateRange): Promise<ExportResult> {
  const [regs, active] = await Promise.all([
    getRegistrationTrend(range, "day"),
    getActiveUsersTrend(range, "day"),
  ]);
  const regFilled = fillDailySeries(range.start, range.end, regs);
  const activeMap = new Map(
    fillDailySeries(range.start, range.end, active).map((p) => [
      p.date,
      p.value,
    ])
  );

  let cumulative = 0;
  const rows = regFilled.map((p) => {
    cumulative += p.value;
    return [
      p.date,
      p.value,
      activeMap.get(p.date) ?? 0,
      cumulative,
    ] as Array<string | number>;
  });
  enforceRowCap(rows.length);
  return {
    filename: filenameFor(
      "users",
      formatISO(range.end, { representation: "date" })
    ),
    rowCount: rows.length,
    csv: toCsv(["date", "new_users", "active_users", "total_users"], rows),
  };
}

async function exportAdminCourses(range: DateRange): Promise<ExportResult> {
  const top = await getTopCoursesByPerformance(range, 500);
  const rows = top.map((c) => [
    c.courseId,
    c.title,
    c.instructor,
    c.enrollments,
    c.completions,
    c.completionRate,
    c.revenue,
  ]);
  enforceRowCap(rows.length);
  return {
    filename: filenameFor(
      "courses",
      formatISO(range.end, { representation: "date" })
    ),
    rowCount: rows.length,
    csv: toCsv(
      [
        "course_id",
        "title",
        "instructor",
        "enrollments",
        "completions",
        "completion_rate",
        "revenue",
      ],
      rows
    ),
  };
}

async function exportAdminRevenue(
  range: DateRange,
  includeArchived?: boolean
): Promise<ExportResult> {
  const trend = await getRevenueTrend(range, "day", { includeArchived });
  const filled = fillDailySeries(range.start, range.end, trend);
  const rows = filled.map((p) => [p.date, p.value]);
  enforceRowCap(rows.length);
  return {
    filename: filenameFor(
      "revenue",
      formatISO(range.end, { representation: "date" })
    ),
    rowCount: rows.length,
    csv: toCsv(["date", "revenue"], rows),
  };
}

async function exportAdminEnrollments(
  range: DateRange,
  includeArchived?: boolean
): Promise<ExportResult> {
  const trend = await getEnrollmentTrend(range, "day", { includeArchived });
  const filled = fillDailySeries(range.start, range.end, trend);
  const rows = filled.map((p) => [p.date, p.value]);
  enforceRowCap(rows.length);
  return {
    filename: filenameFor(
      "enrollments",
      formatISO(range.end, { representation: "date" })
    ),
    rowCount: rows.length,
    csv: toCsv(["date", "enrollments"], rows),
  };
}

async function exportAdminActivity(
  range: DateRange,
  includeArchived?: boolean
): Promise<ExportResult> {
  const hours = await getActivityByHour(range, undefined, { includeArchived });
  const rows = hours.map((h) => [h.hour, h.count]);
  enforceRowCap(rows.length);
  return {
    filename: filenameFor(
      "activity",
      formatISO(range.end, { representation: "date" })
    ),
    rowCount: rows.length,
    csv: toCsv(["hour", "login_count"], rows),
  };
}

async function exportInstructorStudents(
  courseId: string
): Promise<ExportResult> {
  const pageSize = 100;
  const rows: Array<Array<string | number | null>> = [];
  let page = 1;
  let total = Infinity;

  while (rows.length < MAX_EXPORT_ROWS && (page - 1) * pageSize < total) {
    const result = await getCourseStudentProgress({
      courseId,
      page,
      pageSize,
      sortBy: "name",
      sortOrder: "asc",
    });
    total = result.pagination.total;
    for (const s of result.students) {
      rows.push([
        s.name,
        s.enrollmentDate,
        s.progressPercent,
        s.lastActivityDate,
        s.status,
      ]);
      if (rows.length >= MAX_EXPORT_ROWS) break;
    }
    if (result.students.length === 0) break;
    page += 1;
  }

  if (total > MAX_EXPORT_ROWS) {
    enforceRowCap(total);
  }
  enforceRowCap(rows.length);

  return {
    filename: filenameFor(
      "students",
      formatISO(new Date(), { representation: "date" })
    ),
    rowCount: rows.length,
    csv: toCsv(
      ["name", "enrollment_date", "progress_percent", "last_activity", "status"],
      rows
    ),
  };
}

async function exportInstructorActivity(
  instructorId: string,
  range: DateRange,
  courseId?: string
): Promise<ExportResult> {
  const trend = await getInstructorActivityTrend(
    instructorId,
    range,
    courseId
  );
  const filled = fillDailySeries(range.start, range.end, trend);
  const rows = filled.map((p) => [p.date, p.value]);
  enforceRowCap(rows.length);
  return {
    filename: filenameFor(
      "activity",
      formatISO(range.end, { representation: "date" })
    ),
    rowCount: rows.length,
    csv: toCsv(["date", "logins"], rows),
  };
}

async function exportInstructorRevenue(
  instructorId: string,
  range: DateRange,
  courseId?: string
): Promise<ExportResult> {
  const [trend, byCourse] = await Promise.all([
    getInstructorEarningsTrend(instructorId, range, "day", courseId),
    getInstructorEarningsByCourse(instructorId, range, courseId),
  ]);
  const filled = fillDailySeries(range.start, range.end, trend);
  const trendRows = filled.map((p) => ["trend", p.date, p.value, "", ""]);
  const courseRows = byCourse.map((c) => [
    "course",
    "",
    c.amount,
    c.courseId,
    c.title,
  ]);
  const rows = [...trendRows, ...courseRows];
  enforceRowCap(rows.length);
  return {
    filename: filenameFor(
      "revenue",
      formatISO(range.end, { representation: "date" })
    ),
    rowCount: rows.length,
    csv: toCsv(
      ["row_type", "date", "amount", "course_id", "course_title"],
      rows
    ),
  };
}

/**
 * Build a role-scoped analytics CSV export (FR-014).
 * Caps at MAX_EXPORT_ROWS; throws ExportError when exceeded.
 */
export async function buildAnalyticsExport(
  options: ExportRequestOptions
): Promise<ExportResult> {
  const { user, section, startDate, endDate, courseId, includeArchived } =
    options;
  const scope = resolveExportScope(user, section, courseId);

  const range = resolveDateRange({
    preset: "custom",
    startDate,
    endDate,
  });

  if (scope === "admin") {
    switch (section) {
      case "users":
        return exportAdminUsers(range);
      case "courses":
        return exportAdminCourses(range);
      case "revenue":
        return exportAdminRevenue(range, includeArchived);
      case "enrollments":
        return exportAdminEnrollments(range, includeArchived);
      case "activity":
        return exportAdminActivity(range, includeArchived);
      default:
        throw new ExportError(400, "VALIDATION_ERROR", "Invalid admin section");
    }
  }

  const instructorId = options.instructorId || user.id;

  if (section === "students") {
    if (!courseId) {
      throw new ExportError(
        400,
        "VALIDATION_ERROR",
        "courseId is required for students export"
      );
    }
    return exportInstructorStudents(courseId);
  }

  if (section === "activity") {
    return exportInstructorActivity(instructorId, range, courseId);
  }

  if (section === "revenue") {
    return exportInstructorRevenue(instructorId, range, courseId);
  }

  throw new ExportError(400, "VALIDATION_ERROR", "Invalid instructor section");
}

/** Stream CSV as a ReadableStream for Response bodies. */
export function csvToReadableStream(csv: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunkSize = 64 * 1024;
  let offset = 0;

  return new ReadableStream({
    pull(controller) {
      if (offset >= csv.length) {
        controller.close();
        return;
      }
      const slice = csv.slice(offset, offset + chunkSize);
      offset += chunkSize;
      controller.enqueue(encoder.encode(slice));
    },
  });
}
