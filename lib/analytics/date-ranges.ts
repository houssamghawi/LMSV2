import {
  subDays,
  differenceInCalendarDays,
  addDays,
  subMonths,
  max as maxDate,
  min as minDate,
  startOfDay,
  endOfDay,
  formatISO,
} from "date-fns";

export type DateRangePreset = "7d" | "30d" | "90d" | "custom";

export interface DateRange {
  start: Date;
  end: Date;
  preset: DateRangePreset;
}

export interface ComparedDateRanges {
  current: DateRange;
  previous: DateRange;
}

const PRESET_DAYS: Record<Exclude<DateRangePreset, "custom">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

/** Hard cap: 24 months of history (spec retention window). */
export const MAX_ANALYTICS_MONTHS = 24;

export function getMaxLookbackDate(now: Date = new Date()): Date {
  return startOfDay(subMonths(now, MAX_ANALYTICS_MONTHS));
}

export function clampToMaxLookback(start: Date, now: Date = new Date()): Date {
  return maxDate([startOfDay(start), getMaxLookbackDate(now)]);
}

/**
 * Resolve a preset or custom date range, clamping start to the 24-month lookback.
 * Presets are inclusive of today (e.g. 7d = today and the previous 6 days).
 */
export function resolveDateRange(options: {
  preset?: DateRangePreset;
  startDate?: string | Date;
  endDate?: string | Date;
  now?: Date;
}): DateRange {
  const now = options.now ?? new Date();
  const end = endOfDay(
    options.endDate ? new Date(options.endDate) : now
  );

  let start: Date;
  let preset: DateRangePreset;

  if (options.startDate || options.preset === "custom") {
    preset = "custom";
    start = startOfDay(
      options.startDate ? new Date(options.startDate) : subDays(end, 29)
    );
  } else {
    const key = (options.preset ?? "30d") as Exclude<DateRangePreset, "custom">;
    const days = PRESET_DAYS[key] ?? PRESET_DAYS["30d"];
    preset = PRESET_DAYS[key] ? key : "30d";
    start = startOfDay(subDays(end, days - 1));
  }

  start = clampToMaxLookback(start, now);
  const safeEnd = end < start ? endOfDay(start) : end;

  return { start, end: safeEnd, preset };
}

/** Previous period of equal length immediately before `current`. */
export function getPreviousPeriod(current: DateRange): DateRange {
  const dayCount =
    differenceInCalendarDays(current.end, current.start) + 1;
  const previousEnd = endOfDay(subDays(current.start, 1));
  const previousStart = startOfDay(subDays(previousEnd, dayCount - 1));

  return {
    start: previousStart,
    end: previousEnd,
    preset: "custom",
  };
}

export function getComparedDateRanges(options: {
  preset?: DateRangePreset;
  startDate?: string | Date;
  endDate?: string | Date;
  now?: Date;
}): ComparedDateRanges {
  const current = resolveDateRange(options);
  return { current, previous: getPreviousPeriod(current) };
}

export function toIsoDateString(date: Date): string {
  return formatISO(date, { representation: "date" });
}

export function toDateRangeResponse(range: DateRange): {
  start: string;
  end: string;
} {
  return {
    start: toIsoDateString(range.start),
    end: toIsoDateString(range.end),
  };
}

/** Inclusive day count for a range. */
export function getInclusiveDayCount(range: DateRange): number {
  return differenceInCalendarDays(range.end, range.start) + 1;
}

export function shiftRangeByDays(range: DateRange, days: number): DateRange {
  return {
    start: startOfDay(addDays(range.start, days)),
    end: endOfDay(addDays(range.end, days)),
    preset: "custom",
  };
}

export function isWithinMaxLookback(date: Date, now: Date = new Date()): boolean {
  return date.getTime() >= getMaxLookbackDate(now).getTime();
}

export function minMaxRangeBounds(
  start: Date,
  end: Date,
  now: Date = new Date()
): DateRange {
  const clampedStart = clampToMaxLookback(start, now);
  const clampedEnd = minDate([endOfDay(end), endOfDay(now)]);
  return {
    start: clampedStart,
    end: clampedEnd < clampedStart ? endOfDay(clampedStart) : clampedEnd,
    preset: "custom",
  };
}
