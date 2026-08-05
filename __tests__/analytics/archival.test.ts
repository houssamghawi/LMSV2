import { describe, it, expect } from "vitest";
import {
  buildRetainedDateMatch,
  clampRangeToRetention,
  getRetentionCutoff,
  isPastRetention,
  notArchivedMatch,
} from "@/lib/analytics/archival";
import { subMonths, addDays } from "date-fns";

describe("analytics archival / retention (T069)", () => {
  const now = new Date("2026-07-21T12:00:00.000Z");

  it("getRetentionCutoff is ~24 months before now", () => {
    const cutoff = getRetentionCutoff(now);
    const expected = subMonths(now, 24);
    expect(Math.abs(cutoff.getTime() - expected.setHours(0, 0, 0, 0))).toBeLessThan(
      48 * 60 * 60 * 1000
    );
  });

  it("clampRangeToRetention raises start to cutoff", () => {
    const range = {
      start: subMonths(now, 36),
      end: now,
      preset: "custom" as const,
    };
    const clamped = clampRangeToRetention(range, now);
    expect(clamped.start.getTime()).toBe(getRetentionCutoff(now).getTime());
    expect(clamped.end).toEqual(range.end);
  });

  it("buildRetainedDateMatch excludes archived by default", () => {
    const range = {
      start: subMonths(now, 1),
      end: now,
      preset: "custom" as const,
    };
    const match = buildRetainedDateMatch("paidAt", range, { now });
    expect(match.archivedAt).toBeNull();
    expect(match.paidAt).toEqual({
      $gte: range.start,
      $lte: range.end,
    });
  });

  it("buildRetainedDateMatch can include archived for compliance export", () => {
    const range = {
      start: subMonths(now, 1),
      end: now,
      preset: "custom" as const,
    };
    const match = buildRetainedDateMatch("paidAt", range, {
      now,
      includeArchived: true,
    });
    expect(match.archivedAt).toBeUndefined();
  });

  it("isPastRetention detects dates before cutoff", () => {
    expect(isPastRetention(subMonths(now, 30), now)).toBe(true);
    expect(isPastRetention(addDays(getRetentionCutoff(now), 1), now)).toBe(
      false
    );
  });

  it("notArchivedMatch uses null sentinel (matches missing field in Mongo)", () => {
    expect(notArchivedMatch()).toEqual({ archivedAt: null });
  });
});
