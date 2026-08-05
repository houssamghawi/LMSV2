"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DateRangePreset } from "@/lib/analytics/date-ranges";

export interface AnalyticsDateRangeValue {
  preset: DateRangePreset;
  from?: Date;
  to?: Date;
}

export interface DateRangePickerProps {
  value: AnalyticsDateRangeValue;
  onChange: (value: AnalyticsDateRangeValue) => void;
  className?: string;
  disabled?: boolean;
}

const PRESETS: Exclude<DateRangePreset, "custom">[] = ["7d", "30d", "90d"];

export function DateRangePicker({
  value,
  onChange,
  className,
  disabled = false,
}: DateRangePickerProps) {
  const t = useTranslations("Analytics.dateRange");
  const [customOpen, setCustomOpen] = useState(false);

  const presetLabel = (preset: Exclude<DateRangePreset, "custom">) => {
    if (preset === "7d") return t("last7Days");
    if (preset === "90d") return t("last90Days");
    return t("last30Days");
  };

  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      role="group"
      aria-label={t("label")}
    >
      {PRESETS.map((preset) => {
        const selected = value.preset === preset;
        return (
          <Button
            key={preset}
            type="button"
            size="sm"
            variant={selected ? "default" : "outline"}
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onChange({ preset, from: undefined, to: undefined })}
          >
            {presetLabel(preset)}
          </Button>
        );
      })}

      <Popover open={customOpen} onOpenChange={setCustomOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant={value.preset === "custom" ? "default" : "outline"}
            disabled={disabled}
            aria-pressed={value.preset === "custom"}
            className="min-w-[12rem] justify-start"
          >
            <CalendarIcon className="me-2 h-4 w-4" aria-hidden="true" />
            {value.preset === "custom" && value.from && value.to
              ? `${format(value.from, "LLL dd, y")} – ${format(value.to, "LLL dd, y")}`
              : t("custom")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="sr-only" id="analytics-custom-range-label">
            {t("custom")}
          </div>
          <Calendar
            initialFocus
            mode="range"
            numberOfMonths={2}
            aria-labelledby="analytics-custom-range-label"
            selected={
              value.from
                ? { from: value.from, to: value.to }
                : undefined
            }
            onSelect={(range) => {
              if (!range?.from) return;
              onChange({
                preset: "custom",
                from: range.from,
                to: range.to ?? range.from,
              });
              if (range.from && range.to) {
                setCustomOpen(false);
              }
            }}
            disabled={disabled}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
