"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import type { AnalyticsDateRangeValue } from "@/components/analytics/date-range-picker";
import type {
  DashboardPreferenceData,
  PreferenceRole,
  WidgetConfig,
} from "@/lib/analytics/preference-defaults";
import { defaultPreferences } from "@/lib/analytics/preference-defaults";

interface AnalyticsPreferencesContextValue {
  role: PreferenceRole;
  prefs: DashboardPreferenceData;
  loading: boolean;
  defaultRange: AnalyticsDateRangeValue;
  visibleWidgets: WidgetConfig[];
  refresh: () => void;
  save: (next: Partial<DashboardPreferenceData>) => Promise<boolean>;
}

const AnalyticsPreferencesContext =
  createContext<AnalyticsPreferencesContextValue | null>(null);

function toRangeValue(prefs: DashboardPreferenceData): AnalyticsDateRangeValue {
  if (
    prefs.defaultDateRange === "custom" &&
    prefs.customDateRange?.start &&
    prefs.customDateRange?.end
  ) {
    return {
      preset: "custom",
      from: new Date(prefs.customDateRange.start),
      to: new Date(prefs.customDateRange.end),
    };
  }
  const preset =
    prefs.defaultDateRange === "custom" ? "30d" : prefs.defaultDateRange;
  return { preset };
}

export function AnalyticsPreferencesProvider({
  role,
  children,
}: {
  role: PreferenceRole;
  children: ReactNode;
}) {
  const [prefs, setPrefs] = useState<DashboardPreferenceData>(() =>
    defaultPreferences(role)
  );
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/analytics/preferences?role=${role}`,
          { credentials: "include" }
        );
        const body = await res.json();
        if (res.ok && body.success) {
          setPrefs(body.data as DashboardPreferenceData);
        }
      } catch {
        // keep defaults
      } finally {
        setLoading(false);
      }
    });
  }, [role]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (next: Partial<DashboardPreferenceData>): Promise<boolean> => {
      try {
        const res = await fetch("/api/analytics/preferences", {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role,
            layout: next.layout ?? prefs.layout,
            defaultDateRange: next.defaultDateRange ?? prefs.defaultDateRange,
            customDateRange:
              next.customDateRange === undefined
                ? prefs.customDateRange ?? null
                : next.customDateRange,
            hiddenWidgets: next.hiddenWidgets ?? prefs.hiddenWidgets,
          }),
        });
        const body = await res.json();
        if (!res.ok || !body.success) return false;
        setPrefs(body.data as DashboardPreferenceData);
        return true;
      } catch {
        return false;
      }
    },
    [prefs, role]
  );

  const visibleWidgets = useMemo(
    () =>
      [...prefs.layout]
        .filter((w) => w.visible && !prefs.hiddenWidgets.includes(w.id))
        .sort((a, b) => a.position - b.position),
    [prefs]
  );

  const value = useMemo(
    () => ({
      role,
      prefs,
      loading: loading || pending,
      defaultRange: toRangeValue(prefs),
      visibleWidgets,
      refresh,
      save,
    }),
    [role, prefs, loading, pending, visibleWidgets, refresh, save]
  );

  return (
    <AnalyticsPreferencesContext.Provider value={value}>
      {children}
    </AnalyticsPreferencesContext.Provider>
  );
}

export function useAnalyticsPreferences(): AnalyticsPreferencesContextValue {
  const ctx = useContext(AnalyticsPreferencesContext);
  if (!ctx) {
    throw new Error(
      "useAnalyticsPreferences must be used within AnalyticsPreferencesProvider"
    );
  }
  return ctx;
}

/** Safe default range when provider is optional. */
export function useAnalyticsDefaultRange(): AnalyticsDateRangeValue {
  const ctx = useContext(AnalyticsPreferencesContext);
  if (!ctx) return { preset: "30d" };
  return ctx.defaultRange;
}
