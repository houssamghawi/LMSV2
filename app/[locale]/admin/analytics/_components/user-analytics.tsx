"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslations } from "next-intl";
import { ChartWrapper } from "@/components/analytics/chart-wrapper";
import {
  DateRangePicker,
  type AnalyticsDateRangeValue,
} from "@/components/analytics/date-range-picker";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  resolveDateRange,
  toIsoDateString,
} from "@/lib/analytics/date-ranges";
import type { Granularity } from "@/lib/analytics/schemas";
import type { UserAnalyticsData } from "@/service/analytics/admin-analytics.service";
import { useAnalyticsDefaultRange } from "@/components/analytics/analytics-preferences-context";
import { ExportButton } from "@/components/analytics/export-button";

const ROLE_COLORS = ["#0f766e", "#0369a1", "#a16207"];

function buildUsersUrl(
  rangeValue: AnalyticsDateRangeValue,
  granularity: Granularity
): string {
  const range = resolveDateRange({
    preset: rangeValue.preset,
    startDate: rangeValue.from,
    endDate: rangeValue.to,
  });
  const params = new URLSearchParams({
    startDate: toIsoDateString(range.start),
    endDate: toIsoDateString(range.end),
    granularity,
  });
  return `/api/analytics/admin/users?${params.toString()}`;
}

export function UserAnalytics() {
  const t = useTranslations("Analytics");
  const preferredRange = useAnalyticsDefaultRange();
  const [rangeValue, setRangeValue] =
    useState<AnalyticsDateRangeValue>(preferredRange);
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [data, setData] = useState<UserAnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [initialLoading, setInitialLoading] = useState(true);

  const load = useCallback(
    (nextRange: AnalyticsDateRangeValue, nextGranularity: Granularity) => {
      startTransition(async () => {
        setError(null);
        try {
          const res = await fetch(buildUsersUrl(nextRange, nextGranularity), {
            credentials: "include",
          });
          const body = await res.json();
          if (!res.ok || !body.success) {
            setError(body.error ?? t("errors.loadFailed"));
            setData(null);
            return;
          }
          setData(body.data as UserAnalyticsData);
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

  const preferredKey = `${preferredRange.preset}|${preferredRange.from?.toISOString() ?? ""}|${preferredRange.to?.toISOString() ?? ""}`;

  useEffect(() => {
    setRangeValue(preferredRange);
    load(preferredRange, granularity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferredKey]);

  const loading = initialLoading || pending;

  const onRangeChange = (next: AnalyticsDateRangeValue) => {
    setRangeValue(next);
    load(next, granularity);
  };

  const onGranularityChange = (next: Granularity) => {
    setGranularity(next);
    load(rangeValue, next);
  };

  const roleChartData =
    data?.roleDistribution.map((item) => ({
      name: item.role,
      value: item.count,
    })) ?? [];

  const hourChartData =
    data?.activityByHour.map((item) => ({
      hour: `${item.hour}:00`,
      count: item.count,
    })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <DateRangePicker
          value={rangeValue}
          onChange={onRangeChange}
          disabled={loading}
        />
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label={t("granularity.day")}
        >
          {(["day", "week", "month"] as Granularity[]).map((g) => (
            <Button
              key={g}
              type="button"
              size="sm"
              variant={granularity === g ? "default" : "outline"}
              disabled={loading}
              aria-pressed={granularity === g}
              onClick={() => onGranularityChange(g)}
            >
              {t(`granularity.${g}`)}
            </Button>
          ))}
          <ExportButton section="users" rangeValue={rangeValue} />
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {loading && !data ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-80 w-full rounded-xl" />
          ))}
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">
                {t("metrics.totalStudents")}
              </p>
              <p className="text-2xl font-semibold">{data.totals.students}</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">
                {t("metrics.totalInstructors")}
              </p>
              <p className="text-2xl font-semibold">
                {data.totals.instructors}
              </p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">
                {t("metrics.totalAdmins")}
              </p>
              <p className="text-2xl font-semibold">{data.totals.admins}</p>
            </div>
          </div>

          <div
            className={`grid grid-cols-1 gap-6 lg:grid-cols-2 ${pending ? "opacity-70" : ""}`}
          >
            <ChartWrapper
              title={t("charts.registrationTrend")}
              loading={false}
              empty={data.registrationTrend.length === 0}
              emptyMessage={t("empty.noUsers")}
            >
              <AreaChart data={data.registrationTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#0f766e"
                  fill="#99f6e4"
                  name={t("metrics.newRegistrations")}
                />
              </AreaChart>
            </ChartWrapper>

            <ChartWrapper
              title={t("charts.activeUsersTrend")}
              empty={data.activeUsersTrend.length === 0}
              emptyMessage={t("empty.noActivity")}
            >
              <AreaChart data={data.activeUsersTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#0369a1"
                  fill="#bae6fd"
                  name={t("metrics.activeUsers")}
                />
              </AreaChart>
            </ChartWrapper>

            <ChartWrapper
              title={t("charts.roleDistribution")}
              empty={roleChartData.every((d) => d.value === 0)}
              emptyMessage={t("empty.noUsers")}
            >
              <PieChart>
                <Pie
                  data={roleChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {roleChartData.map((_, index) => (
                    <Cell
                      key={`role-${index}`}
                      fill={ROLE_COLORS[index % ROLE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ChartWrapper>

            <ChartWrapper
              title={t("charts.activityByHour")}
              empty={hourChartData.every((d) => d.count === 0)}
              emptyMessage={t("empty.noActivity")}
            >
              <BarChart data={hourChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#a16207" name={t("sections.activity")} />
              </BarChart>
            </ChartWrapper>
          </div>
        </>
      ) : null}
    </div>
  );
}
