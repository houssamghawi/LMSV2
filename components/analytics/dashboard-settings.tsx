"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Settings2, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnalyticsPreferences } from "@/components/analytics/analytics-preferences-context";
import type { WidgetConfig } from "@/lib/analytics/preference-defaults";
import type { DateRangePreset } from "@/lib/analytics/date-ranges";

function widgetLabelKey(id: string): string {
  return id;
}

export function DashboardSettings() {
  const t = useTranslations("Analytics");
  const { prefs, save, loading } = useAnalyticsPreferences();
  const [open, setOpen] = useState(false);
  const [draftLayout, setDraftLayout] = useState<WidgetConfig[]>(prefs.layout);
  const [draftRange, setDraftRange] = useState<DateRangePreset>(
    prefs.defaultDateRange === "custom" ? "30d" : prefs.defaultDateRange
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const openPanel = () => {
    setDraftLayout(
      [...prefs.layout].sort((a, b) => a.position - b.position)
    );
    setDraftRange(
      prefs.defaultDateRange === "custom" ? "30d" : prefs.defaultDateRange
    );
    setMessage(null);
    setOpen(true);
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...draftLayout].sort((a, b) => a.position - b.position);
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    const tmp = next[index];
    next[index] = next[j];
    next[j] = tmp;
    setDraftLayout(next.map((w, i) => ({ ...w, position: i })));
  };

  const toggleVisible = (id: string) => {
    setDraftLayout((prev) =>
      prev.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w))
    );
  };

  const onSave = () => {
    startTransition(async () => {
      const layout = draftLayout.map((w, i) => ({ ...w, position: i }));
      const ok = await save({
        layout,
        defaultDateRange: draftRange,
        customDateRange: null,
        hiddenWidgets: layout.filter((w) => !w.visible).map((w) => w.id),
      });
      setMessage(ok ? t("settings.saved") : t("settings.saveFailed"));
      if (ok) setOpen(false);
    });
  };

  return (
    <div className="relative">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={openPanel}
        disabled={loading}
      >
        <Settings2 className="me-2 h-4 w-4" aria-hidden="true" />
        {t("settings.title")}
      </Button>

      {open ? (
        <div
          className="absolute end-0 z-20 mt-2 w-[min(100vw-2rem,22rem)] rounded-lg border bg-background p-4 shadow-lg"
          role="dialog"
          aria-label={t("settings.title")}
        >
          <h3 className="text-sm font-semibold">{t("settings.title")}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("settings.hint")}
          </p>

          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {t("settings.widgets")}
            </p>
            {[...draftLayout]
              .sort((a, b) => a.position - b.position)
              .map((w, index) => (
                <div
                  key={w.id}
                  className="flex items-center gap-2 rounded-md border px-2 py-1.5"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={w.visible}
                    onChange={() => toggleVisible(w.id)}
                    aria-label={t(`sections.${widgetLabelKey(w.id)}`)}
                  />
                  <span className="flex-1 text-sm">
                    {t(`sections.${widgetLabelKey(w.id)}`)}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    aria-label={t("settings.moveUp")}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={index === draftLayout.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label={t("settings.moveDown")}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              ))}
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {t("settings.defaultRange")}
            </p>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={draftRange}
              onChange={(e) =>
                setDraftRange(e.target.value as DateRangePreset)
              }
            >
              <option value="7d">{t("dateRange.last7Days")}</option>
              <option value="30d">{t("dateRange.last30Days")}</option>
              <option value="90d">{t("dateRange.last90Days")}</option>
            </select>
          </div>

          {message ? (
            <p className="mt-3 text-xs text-muted-foreground" role="status">
              {message}
            </p>
          ) : null}

          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              {t("settings.cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={onSave}
            >
              {t("settings.save")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
