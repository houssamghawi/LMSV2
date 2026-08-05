import "server-only";
import { dbConnect } from "@/service/mongo";
import { DashboardPreference } from "@/model/dashboard-preference-model";
import type { DateRangePreset } from "@/lib/analytics/date-ranges";
import {
  ADMIN_WIDGET_IDS,
  INSTRUCTOR_WIDGET_IDS,
  defaultPreferences,
  type DashboardPreferenceData,
  type PreferenceRole,
  type WidgetConfig,
} from "@/lib/analytics/preference-defaults";

export type {
  DashboardPreferenceData,
  PreferenceRole,
  WidgetConfig,
  WidgetSize,
} from "@/lib/analytics/preference-defaults";

export {
  ADMIN_WIDGET_IDS,
  INSTRUCTOR_WIDGET_IDS,
  defaultLayoutForRole,
  defaultPreferences,
} from "@/lib/analytics/preference-defaults";

function serializeDoc(doc: {
  role: PreferenceRole;
  layout?: WidgetConfig[];
  defaultDateRange?: DateRangePreset;
  customDateRange?: { start?: Date; end?: Date };
  hiddenWidgets?: string[];
}): DashboardPreferenceData {
  const defaults = defaultPreferences(doc.role);
  const layout =
    Array.isArray(doc.layout) && doc.layout.length > 0
      ? mergeLayout(defaults.layout, doc.layout)
      : defaults.layout;

  const hiddenWidgets = Array.isArray(doc.hiddenWidgets)
    ? doc.hiddenWidgets
    : [];

  const hiddenSet = new Set(hiddenWidgets);
  const syncedLayout = layout.map((w) => ({
    ...w,
    visible: w.visible && !hiddenSet.has(w.id),
  }));

  const result: DashboardPreferenceData = {
    role: doc.role,
    layout: syncedLayout.sort((a, b) => a.position - b.position),
    defaultDateRange: doc.defaultDateRange || "30d",
    hiddenWidgets,
  };

  if (doc.customDateRange?.start && doc.customDateRange?.end) {
    result.customDateRange = {
      start: new Date(doc.customDateRange.start).toISOString(),
      end: new Date(doc.customDateRange.end).toISOString(),
    };
  }

  return result;
}

function mergeLayout(
  defaults: WidgetConfig[],
  saved: WidgetConfig[]
): WidgetConfig[] {
  const byId = new Map(saved.map((w) => [w.id, w]));
  const merged: WidgetConfig[] = defaults.map((d) => {
    const s = byId.get(d.id);
    if (!s) return { ...d };
    return {
      id: d.id,
      position: typeof s.position === "number" ? s.position : d.position,
      size: s.size || d.size,
      visible: s.visible !== false,
    };
  });
  return merged.sort((a, b) => a.position - b.position);
}

export async function getDashboardPreferences(
  userId: string,
  role: PreferenceRole
): Promise<DashboardPreferenceData> {
  await dbConnect();
  const doc = await DashboardPreference.findOne({ user: userId, role }).lean();
  if (!doc) {
    return defaultPreferences(role);
  }
  return serializeDoc(doc as Parameters<typeof serializeDoc>[0]);
}

export interface UpsertDashboardPreferencesInput {
  layout?: WidgetConfig[];
  defaultDateRange?: DateRangePreset;
  customDateRange?: { start: string | Date; end: string | Date } | null;
  hiddenWidgets?: string[];
}

export async function upsertDashboardPreferences(
  userId: string,
  role: PreferenceRole,
  input: UpsertDashboardPreferencesInput
): Promise<DashboardPreferenceData> {
  await dbConnect();

  const allowedIds = new Set(
    (role === "admin"
      ? ADMIN_WIDGET_IDS
      : INSTRUCTOR_WIDGET_IDS) as readonly string[]
  );

  const defaults = defaultPreferences(role);
  let layout = defaults.layout;

  if (input.layout) {
    layout = mergeLayout(
      defaults.layout,
      input.layout.filter((w) => allowedIds.has(w.id))
    );
  }

  let hiddenWidgets =
    input.hiddenWidgets ?? layout.filter((w) => !w.visible).map((w) => w.id);

  hiddenWidgets = hiddenWidgets.filter((id) => allowedIds.has(id));

  if (input.layout) {
    hiddenWidgets = layout.filter((w) => !w.visible).map((w) => w.id);
  }

  layout = [...layout]
    .sort((a, b) => a.position - b.position)
    .map((w, i) => ({
      ...w,
      position: i,
      visible: !hiddenWidgets.includes(w.id),
    }));

  const defaultDateRange = input.defaultDateRange ?? "30d";

  const $set: Record<string, unknown> = {
    user: userId,
    role,
    layout,
    defaultDateRange,
    hiddenWidgets,
    updatedAt: new Date(),
  };

  const $unset: Record<string, 1> = {};

  if (input.customDateRange && defaultDateRange === "custom") {
    $set.customDateRange = {
      start: new Date(input.customDateRange.start),
      end: new Date(input.customDateRange.end),
    };
  } else {
    $unset.customDateRange = 1;
  }

  const updateOps: Record<string, unknown> = {
    $set,
    $setOnInsert: { createdAt: new Date() },
  };
  if (Object.keys($unset).length > 0) {
    updateOps.$unset = $unset;
  }

  const doc = await DashboardPreference.findOneAndUpdate(
    { user: userId, role },
    updateOps,
    { upsert: true, new: true, lean: true }
  );

  return serializeDoc(doc as Parameters<typeof serializeDoc>[0]);
}
