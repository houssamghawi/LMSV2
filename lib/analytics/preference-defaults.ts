import type { DateRangePreset } from "@/lib/analytics/date-ranges";

export type PreferenceRole = "admin" | "instructor";
export type WidgetSize = "small" | "medium" | "large";

export interface WidgetConfig {
  id: string;
  position: number;
  size: WidgetSize;
  visible: boolean;
}

export interface DashboardPreferenceData {
  role: PreferenceRole;
  layout: WidgetConfig[];
  defaultDateRange: DateRangePreset;
  customDateRange?: { start: string; end: string };
  hiddenWidgets: string[];
}

export const ADMIN_WIDGET_IDS = [
  "overview",
  "users",
  "courses",
  "revenue",
  "performance",
  "projections",
] as const;

export const INSTRUCTOR_WIDGET_IDS = [
  "overview",
  "students",
  "activity",
  "earnings",
] as const;

export function defaultLayoutForRole(role: PreferenceRole): WidgetConfig[] {
  const ids =
    role === "admin" ? [...ADMIN_WIDGET_IDS] : [...INSTRUCTOR_WIDGET_IDS];
  return ids.map((id, position) => ({
    id,
    position,
    size: "large" as const,
    visible: true,
  }));
}

export function defaultPreferences(role: PreferenceRole): DashboardPreferenceData {
  return {
    role,
    layout: defaultLayoutForRole(role),
    defaultDateRange: "30d",
    hiddenWidgets: [],
  };
}
