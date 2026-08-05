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
import { useLocale, useTranslations } from "next-intl";
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
import type { RevenueAnalyticsData } from "@/service/analytics/admin-analytics.service";
import { useAnalyticsDefaultRange } from "@/components/analytics/analytics-preferences-context";
import { ExportButton } from "@/components/analytics/export-button";

const STATUS_COLORS = [
  "#0f766e",
  "#b91c1c",
  "#a16207",
  "#0369a1",
  "#6b7280",
  "#7c3aed",
];

function formatMoney(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function buildRevenueUrl(
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
    limit: "10",
  });
  return `/api/analytics/admin/revenue?${params.toString()}`;
}

export function RevenueAnalytics() {
  const t = useTranslations("Analytics");
  const locale = useLocale();
  const preferredRange = useAnalyticsDefaultRange();
  const [rangeValue, setRangeValue] =
    useState<AnalyticsDateRangeValue>(preferredRange);
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [data, setData] = useState<RevenueAnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [initialLoading, setInitialLoading] = useState(true);

  const load = useCallback(
    (nextRange: AnalyticsDateRangeValue, nextGranularity: Granularity) => {
      startTransition(async () => {
        setError(null);
        try {
          const res = await fetch(
            buildRevenueUrl(nextRange, nextGranularity),
            { credentials: "include" }
          );
          const body = await res.json();
          if (!res.ok || !body.success) {
            setError(body.error ?? t("errors.loadFailed"));
            setData(null);
            return;
          }
          setData(body.data as RevenueAnalyticsData);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <DateRangePicker
          value={rangeValue}
          onChange={onRangeChange}
          disabled={loading}
        />
        <div className="flex flex-wrap items-center gap-2" role="group">
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
          <ExportButton section="revenue" rangeValue={rangeValue} />
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">
                {t("metrics.totalRevenue")}
              </p>
              <p className="text-2xl font-semibold">
                {formatMoney(data.totals.revenue, locale)}
              </p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">
                {t("metrics.transactions")}
              </p>
              <p className="text-2xl font-semibold">
                {data.totals.transactions}
              </p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">
                {t("metrics.averageTransaction")}
              </p>
              <p className="text-2xl font-semibold">
                {formatMoney(data.totals.avgTransaction, locale)}
              </p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">
                {t("metrics.successRate")}
              </p>
              <p className="text-2xl font-semibold">
                {(data.totals.successRate * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          <div
            className={`grid grid-cols-1 gap-6 lg:grid-cols-2 ${pending ? "opacity-70" : ""}`}
          >
            <ChartWrapper
              title={t("charts.revenueTrend")}
              empty={data.revenueTrend.length === 0}
              emptyMessage={t("empty.noRevenue")}
              className="lg:col-span-2"
            >
              <AreaChart data={data.revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number) => formatMoney(value, locale)}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#0f766e"
                  fill="#99f6e4"
                  name={t("metrics.totalRevenue")}
                />
              </AreaChart>
            </ChartWrapper>

            <ChartWrapper
              title={t("charts.revenueByCourse")}
              empty={data.revenueByCourse.length === 0}
              emptyMessage={t("empty.noRevenue")}
            >
              <BarChart
                data={data.revenueByCourse}
                layout="vertical"
                margin={{ left: 8, right: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="title"
                  width={120}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip
                  formatter={(value: number) => formatMoney(value, locale)}
                />
                <Bar dataKey="amount" fill="#0369a1" name={t("table.revenue")} />
              </BarChart>
            </ChartWrapper>

            <ChartWrapper
              title={t("charts.revenueByInstructor")}
              empty={data.revenueByInstructor.length === 0}
              emptyMessage={t("empty.noRevenue")}
            >
              <BarChart
                data={data.revenueByInstructor}
                layout="vertical"
                margin={{ left: 8, right: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip
                  formatter={(value: number) => formatMoney(value, locale)}
                />
                <Bar dataKey="amount" fill="#a16207" name={t("table.revenue")} />
              </BarChart>
            </ChartWrapper>

            <ChartWrapper
              title={t("table.status")}
              empty={data.transactionStatusBreakdown.length === 0}
              emptyMessage={t("empty.noRevenue")}
            >
              <PieChart>
                <Pie
                  data={data.transactionStatusBreakdown}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {data.transactionStatusBreakdown.map((_, index) => (
                    <Cell
                      key={`status-${index}`}
                      fill={STATUS_COLORS[index % STATUS_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ChartWrapper>
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[36rem] text-sm">
              <caption className="sr-only">
                {t("charts.revenueByCourse")}
              </caption>
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">{t("table.course")}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t("table.revenue")}</th>
                </tr>
              </thead>
              <tbody>
                {data.revenueByCourse.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-6 text-center text-muted-foreground"
                    >
                      {t("table.noRows")}
                    </td>
                  </tr>
                ) : (
                  data.revenueByCourse.map((row) => (
                    <tr key={row.courseId} className="border-b last:border-0">
                      <td className="px-4 py-3">{row.title}</td>
                      <td className="px-4 py-3">
                        {formatMoney(row.amount, locale)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[36rem] text-sm">
              <caption className="sr-only">
                {t("charts.revenueByInstructor")}
              </caption>
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t("table.instructor")}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">{t("table.revenue")}</th>
                </tr>
              </thead>
              <tbody>
                {data.revenueByInstructor.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-6 text-center text-muted-foreground"
                    >
                      {t("table.noRows")}
                    </td>
                  </tr>
                ) : (
                  data.revenueByInstructor.map((row) => (
                    <tr
                      key={row.instructorId}
                      className="border-b last:border-0"
                    >
                      <td className="px-4 py-3">{row.name}</td>
                      <td className="px-4 py-3">
                        {formatMoney(row.amount, locale)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
