"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExportButton } from "@/components/analytics/export-button";
import { useAnalyticsDefaultRange } from "@/components/analytics/analytics-preferences-context";
import type { StudentProgressData } from "@/service/analytics/instructor-analytics.service";
import type { ProgressStatus } from "@/queries/analytics/progress-aggregations";


export interface CourseOption {
  courseId: string;
  title: string;
}

const STATUS_FILTERS: Array<ProgressStatus | "all"> = [
  "all",
  "not-started",
  "in-progress",
  "near-completion",
  "completed",
];

function formatDate(value: string | null, locale: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function buildStudentsUrl(options: {
  courseId: string;
  page: number;
  status: ProgressStatus | "all";
  sortBy: string;
  sortOrder: string;
}): string {
  const params = new URLSearchParams({
    courseId: options.courseId,
    page: String(options.page),
    pageSize: "20",
    sortBy: options.sortBy,
    sortOrder: options.sortOrder,
  });
  if (options.status !== "all") {
    params.set("status", options.status);
  }
  return `/api/analytics/instructor/students?${params.toString()}`;
}

export function StudentProgress({ courses }: { courses: CourseOption[] }) {
  const t = useTranslations("Analytics");
  const locale = useLocale();
  const exportRange = useAnalyticsDefaultRange();
  const [courseId, setCourseId] = useState(courses[0]?.courseId ?? "");
  const [status, setStatus] = useState<ProgressStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("lastActivity");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [data, setData] = useState<StudentProgressData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (!courseId && courses[0]?.courseId) {
      setCourseId(courses[0].courseId);
    }
  }, [courses, courseId]);

  const load = useCallback(
    (opts: {
      courseId: string;
      page: number;
      status: ProgressStatus | "all";
      sortBy: string;
      sortOrder: string;
    }) => {
      if (!opts.courseId) {
        setData(null);
        setInitialLoading(false);
        return;
      }
      startTransition(async () => {
        setError(null);
        try {
          const res = await fetch(buildStudentsUrl(opts), {
            credentials: "include",
          });
          const body = await res.json();
          if (!res.ok || !body.success) {
            setError(body.error ?? t("errors.loadFailed"));
            setData(null);
            return;
          }
          setData(body.data as StudentProgressData);
        } catch {
          setError(t("errors.loadFailed"));
          setData(null);
        } finally {
          setInitialLoading(false);
        }
      });
    },
    [t]
  );

  useEffect(() => {
    if (!courseId) {
      setInitialLoading(false);
      return;
    }
    load({ courseId, page, status, sortBy, sortOrder });
  }, [courseId, page, status, sortBy, sortOrder, load]);

  const loading = initialLoading || pending;
  const totalPages = data
    ? Math.max(1, Math.ceil(data.pagination.total / data.pagination.pageSize))
    : 1;

  if (courses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("empty.noCourses")}</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t("table.course")}</span>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value);
              setPage(1);
            }}
            disabled={loading}
          >
            {courses.map((c) => (
              <option key={c.courseId} value={c.courseId}>
                {c.title}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-2" role="group">
          {STATUS_FILTERS.map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant={status === s ? "default" : "outline"}
              disabled={loading}
              aria-pressed={status === s}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
            >
              {s === "all" ? t("progressStatus.all") : t(`progressStatus.${s}`)}
            </Button>
          ))}
          {courseId ? (
            <ExportButton
              section="students"
              rangeValue={exportRange}
              courseId={courseId}
            />
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {data ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="rounded-xl border p-3">
            <p className="text-xs text-muted-foreground">
              {t("metrics.averageProgress")}
            </p>
            <p className="text-xl font-semibold">{data.aggregates.avgProgress}%</p>
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-xs text-muted-foreground">
              {t("progressStatus.not-started")}
            </p>
            <p className="text-xl font-semibold">{data.aggregates.notStarted}</p>
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-xs text-muted-foreground">
              {t("progressStatus.in-progress")}
            </p>
            <p className="text-xl font-semibold">{data.aggregates.inProgress}</p>
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-xs text-muted-foreground">
              {t("progressStatus.near-completion")}
            </p>
            <p className="text-xl font-semibold">
              {data.aggregates.nearCompletion}
            </p>
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-xs text-muted-foreground">
              {t("progressStatus.completed")}
            </p>
            <p className="text-xl font-semibold">{data.aggregates.completed}</p>
          </div>
        </div>
      ) : null}

      {loading && !data ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : null}

      {data ? (
        <>
          <div className={`overflow-x-auto rounded-xl border ${pending ? "opacity-70" : ""}`}>
            <table className="w-full min-w-[48rem] text-sm">
              <caption className="sr-only">{t("charts.studentProgress")}</caption>
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() => {
                        setSortBy("name");
                        setSortOrder((o) =>
                          sortBy === "name" && o === "asc" ? "desc" : "asc"
                        );
                      }}
                    >
                      {t("table.student")}
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() => {
                        setSortBy("enrollmentDate");
                        setSortOrder((o) =>
                          sortBy === "enrollmentDate" && o === "asc"
                            ? "desc"
                            : "asc"
                        );
                      }}
                    >
                      {t("table.enrolled")}
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() => {
                        setSortBy("progress");
                        setSortOrder((o) =>
                          sortBy === "progress" && o === "asc" ? "desc" : "asc"
                        );
                      }}
                    >
                      {t("table.progress")}
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() => {
                        setSortBy("lastActivity");
                        setSortOrder((o) =>
                          sortBy === "lastActivity" && o === "asc"
                            ? "desc"
                            : "asc"
                        );
                      }}
                    >
                      {t("table.lastActivity")}
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">{t("table.status")}</th>
                </tr>
              </thead>
              <tbody>
                {data.students.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-muted-foreground"
                    >
                      {t("empty.noStudents")}
                    </td>
                  </tr>
                ) : (
                  data.students.map((row) => (
                    <tr key={row.studentId} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium">{row.name}</div>
                        {(row.currentModule || row.currentLesson) && (
                          <div className="text-xs text-muted-foreground">
                            {[row.currentModule, row.currentLesson]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        )}
                        {row.quizAverage != null && (
                          <div className="text-xs text-muted-foreground">
                            {t("quizAverage", { value: row.quizAverage })}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {formatDate(row.enrollmentDate, locale)}
                      </td>
                      <td className="px-4 py-3">{row.progressPercent}%</td>
                      <td className="px-4 py-3">
                        {formatDate(row.lastActivityDate, locale)}
                      </td>
                      <td className="px-4 py-3">
                        {t(`progressStatus.${row.status}`)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {data.pagination.total} {t("sections.students").toLowerCase()}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loading || page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t("paginationPrev")}
              </Button>
              <span className="flex items-center text-sm">
                {page} / {totalPages}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loading || page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("paginationNext")}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
