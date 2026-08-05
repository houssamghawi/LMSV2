"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { CourseOverview } from "./course-overview";
import type { CourseOption } from "./student-progress";
import {
  resolveDateRange,
  toIsoDateString,
} from "@/lib/analytics/date-ranges";
import {
  AnalyticsPreferencesProvider,
  useAnalyticsPreferences,
} from "@/components/analytics/analytics-preferences-context";
import { DashboardSettings } from "@/components/analytics/dashboard-settings";

function ChartSectionFallback() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

const StudentProgress = dynamic(
  () => import("./student-progress").then((m) => m.StudentProgress),
  { loading: () => <ChartSectionFallback />, ssr: false }
);
const ActivityAnalytics = dynamic(
  () => import("./activity-analytics").then((m) => m.ActivityAnalytics),
  { loading: () => <ChartSectionFallback />, ssr: false }
);
const RevenuePanel = dynamic(
  () => import("./revenue-panel").then((m) => m.RevenuePanel),
  { loading: () => <ChartSectionFallback />, ssr: false }
);

const PANEL_FACTORY: Record<
  string,
  (courses: CourseOption[]) => ReactNode
> = {
  overview: () => <CourseOverview />,
  students: (courses) => <StudentProgress courses={courses} />,
  activity: (courses) => <ActivityAnalytics courses={courses} />,
  earnings: (courses) => <RevenuePanel courses={courses} />,
};

function InstructorDashboardInner() {
  const t = useTranslations("Analytics.sections");
  const tSettings = useTranslations("Analytics.settings");
  const { visibleWidgets, prefs, defaultRange } = useAnalyticsPreferences();
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [pending, startTransition] = useTransition();

  const loadCourses = useCallback(() => {
    startTransition(async () => {
      try {
        const range = resolveDateRange({
          preset: defaultRange.preset,
          startDate: defaultRange.from,
          endDate: defaultRange.to,
        });
        const params = new URLSearchParams({
          startDate: toIsoDateString(range.start),
          endDate: toIsoDateString(range.end),
        });
        const res = await fetch(
          `/api/analytics/instructor/overview?${params.toString()}`,
          { credentials: "include" }
        );
        const body = await res.json();
        if (res.ok && body.success) {
          setCourses(
            (body.data.courses || []).map(
              (c: { courseId: string; title: string }) => ({
                courseId: c.courseId,
                title: c.title,
              })
            )
          );
        }
      } catch {
        setCourses([]);
      }
    });
  }, [defaultRange]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const defaultTab = visibleWidgets[0]?.id ?? "overview";
  const tabsKey = prefs.layout
    .map((w) => `${w.id}:${w.visible}:${w.position}`)
    .join("|");

  if (visibleWidgets.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <DashboardSettings />
        </div>
        <p className="text-sm text-muted-foreground">{tSettings("noWidgets")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DashboardSettings />
      </div>

      <Tabs key={tabsKey} defaultValue={defaultTab} className="w-full">
        <TabsList className="mb-4 flex h-auto flex-wrap gap-1">
          {visibleWidgets.map((w) => (
            <TabsTrigger key={w.id} value={w.id}>
              {t(w.id)}
            </TabsTrigger>
          ))}
        </TabsList>
        {visibleWidgets.map((w) => (
          <TabsContent key={w.id} value={w.id} className="mt-4">
            {w.id === "students" && pending && courses.length === 0 ? (
              <ChartSectionFallback />
            ) : (
              PANEL_FACTORY[w.id]?.(courses)
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export function InstructorAnalyticsDashboard() {
  return (
    <AnalyticsPreferencesProvider role="instructor">
      <InstructorDashboardInner />
    </AnalyticsPreferencesProvider>
  );
}
