// =============================================================================
// Analytics Page
// =============================================================================

"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAnalytics, useMiniAppUsage } from "@/lib/hooks/useAnalytics";
import { formatNumber } from "@/lib/utils";

export default function AnalyticsPage() {
  const {
    data: analytics,
    isLoading: analyticsLoading,
    isError: analyticsError,
  } = useAnalytics();
  const {
    data: usage,
    isLoading: usageLoading,
    isError: usageError,
  } = useMiniAppUsage(30);
  const chartData = useMemo(() => {
    const daily = new Map<string, number>();
    for (const row of usage || []) {
      const date = String(row.usage_date || "");
      if (!date) continue;
      daily.set(date, (daily.get(date) || 0) + Number(row.gas_used || 0));
    }
    return Array.from(daily.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, gas]) => ({ date, gas }));
  }, [usage]);
  const maxChartValue = chartData.reduce(
    (max, point) => Math.max(max, point.gas),
    0,
  );
  const maxAppGas = Math.max(
    ...(analytics?.usageByApp || []).map((app) => Number(app.total_gas) || 0),
    0,
  );
  const summaryItems = [
    {
      label: "Total Users",
      value: analyticsLoading ? "..." : formatNumber(analytics?.totalUsers || 0),
      helper: "Registered accounts",
      accent: "bg-emerald-500",
    },
    {
      label: "Total MiniApps",
      value: analyticsLoading
        ? "..."
        : formatNumber(analytics?.totalMiniApps || 0),
      helper: "Configured products",
      accent: "bg-cyan-500",
    },
    {
      label: "Transactions",
      value: analyticsLoading
        ? "..."
        : formatNumber(analytics?.totalTransactions || 0),
      helper: "Chain activity",
      accent: "bg-violet-500",
    },
    {
      label: "GAS Today",
      value: analyticsLoading
        ? "..."
        : formatNumber(analytics?.gasUsageToday || 0),
      helper: "Daily consumption",
      accent: "bg-amber-500",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Track adoption, chain activity, and MiniApp resource usage."
        highlightLastWord
      />

      {analyticsError && (
        <div
          role="alert"
          aria-label="Analytics overview could not be loaded"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4"
        >
          <p className="text-sm font-semibold text-amber-800">
            Analytics overview could not be loaded
          </p>
          <p className="mt-1 text-sm text-amber-700">
            The dashboard is still available, but the KPI totals may be
            incomplete until the API responds again.
          </p>
        </div>
      )}

      <div
        aria-label="Analytics KPI summary"
        className="analytics-summary-grid grid gap-3 lg:grid-cols-4"
      >
        {summaryItems.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase text-gray-500">
                {item.label}
              </p>
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 rounded-full ${item.accent}`}
              />
            </div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="text-2xl font-black text-gray-950">
                {item.value}
              </p>
              <p className="text-right text-xs font-medium text-gray-500">
                {item.helper}
              </p>
            </div>
          </div>
        ))}
      </div>

      {usageError && (
        <div
          role="alert"
          aria-label="Usage history could not be loaded"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4"
        >
          <p className="text-sm font-semibold text-amber-800">
            Usage history could not be loaded
          </p>
          <p className="mt-1 text-sm text-amber-700">
            KPI totals and MiniApp ranking remain visible when available.
          </p>
        </div>
      )}

      {!usageError && (
        <Card
          aria-label="Gas usage trend"
          className="analytics-chart-card"
          variant="default"
        >
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>Usage Over Time</CardTitle>
              <p className="mt-1 text-sm text-gray-500">
                Last 30 days of MiniApp GAS consumption, grouped by usage date.
              </p>
            </div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              30 days
            </span>
          </CardHeader>
          <CardContent>
            {usageLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : chartData.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
                <p className="text-sm font-semibold text-gray-700">
                  No usage data available yet.
                </p>
              </div>
            ) : (
              <div
                className="flex h-52 items-end gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 pb-4 pt-6"
                aria-label="Gas usage chart for the last 30 days"
              >
                {chartData.map((point) => {
                  const heightPercent =
                    maxChartValue > 0
                      ? Math.max((point.gas / maxChartValue) * 100, 4)
                      : 4;
                  return (
                    <div
                      key={point.date}
                      className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                    >
                      <div className="flex h-36 w-full items-end">
                        <div
                          className="w-full rounded-t-md bg-emerald-500"
                          style={{ height: `${heightPercent}%` }}
                          title={`${point.date}: ${formatNumber(point.gas)}`}
                          aria-label={`Gas usage on ${point.date}: ${formatNumber(point.gas)}`}
                        />
                      </div>
                      <span className="hidden w-full truncate text-center text-[10px] font-medium text-gray-500 sm:block">
                        {point.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card
        aria-label="Usage by MiniApp"
        className="analytics-apps-card"
        variant="default"
      >
        <CardHeader>
          <CardTitle>Usage by MiniApp</CardTitle>
          <p className="mt-1 text-sm text-gray-500">
            Highest GAS consumers with user and governance usage context.
          </p>
        </CardHeader>
        <CardContent>
          {analyticsLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : analytics?.usageByApp && analytics.usageByApp.length > 0 ? (
            <ul className="space-y-3">
              {analytics.usageByApp.slice(0, 10).map((app) => (
                <li
                  key={app.app_id}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div
                        className="truncate font-semibold text-gray-950"
                        title={app.app_id}
                      >
                        {app.app_id}
                      </div>
                      <div className="mt-1 text-sm text-gray-500">
                        {app.user_count} users
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm sm:min-w-52">
                      <div>
                        <p className="text-xs font-semibold uppercase text-gray-500">
                          GAS
                        </p>
                        <p className="font-bold text-gray-950">
                          GAS {formatNumber(app.total_gas)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase text-gray-500">
                          GOV
                        </p>
                        <p className="font-bold text-gray-950">
                          GOV {formatNumber(app.total_governance)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div
                    aria-hidden="true"
                    className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200"
                  >
                    <div
                      className="h-full rounded-full bg-cyan-500"
                      style={{
                        width: `${
                          maxAppGas > 0
                            ? Math.max((app.total_gas / maxAppGas) * 100, 4)
                            : 4
                        }%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm font-semibold text-gray-500">
              No usage data available
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
