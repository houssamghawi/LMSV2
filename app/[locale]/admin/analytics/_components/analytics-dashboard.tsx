"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { OverviewCards } from "./overview-cards";
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

const UserAnalytics = dynamic(
  () => import("./user-analytics").then((m) => m.UserAnalytics),
  { loading: () => <ChartSectionFallback />, ssr: false }
);
const RevenueAnalytics = dynamic(
  () => import("./revenue-analytics").then((m) => m.RevenueAnalytics),
  { loading: () => <ChartSectionFallback />, ssr: false }
);
const CourseAnalytics = dynamic(
  () => import("./course-analytics").then((m) => m.CourseAnalytics),
  { loading: () => <ChartSectionFallback />, ssr: false }
);
const PerformancePanel = dynamic(
  () => import("./performance-panel").then((m) => m.PerformancePanel),
  { loading: () => <ChartSectionFallback />, ssr: false }
);
const ProjectionsPanel = dynamic(
  () => import("./projections-panel").then((m) => m.ProjectionsPanel),
  { loading: () => <ChartSectionFallback />, ssr: false }
);

const PANEL: Record<string, ReactNode> = {
  overview: <OverviewCards />,
  users: <UserAnalytics />,
  courses: <CourseAnalytics />,
  revenue: <RevenueAnalytics />,
  performance: <PerformancePanel />,
  projections: <ProjectionsPanel />,
};

function AdminDashboardInner() {
  const t = useTranslations("Analytics.sections");
  const tSettings = useTranslations("Analytics.settings");
  const { visibleWidgets, prefs } = useAnalyticsPreferences();
  const defaultTab = visibleWidgets[0]?.id ?? "overview";
  const tabsKey = prefs.layout.map((w) => `${w.id}:${w.visible}:${w.position}`).join("|");

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
            {PANEL[w.id]}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export function AnalyticsDashboard() {
  return (
    <AnalyticsPreferencesProvider role="admin">
      <AdminDashboardInner />
    </AnalyticsPreferencesProvider>
  );
}
