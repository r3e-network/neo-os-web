// =============================================================================
// Analytics Page
// =============================================================================

"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { useAnalytics, useMiniAppUsage } from "@/lib/hooks/useAnalytics";
import { formatNumber } from "@/lib/utils";

export default function AnalyticsPage() {
  const { data: analytics, isLoading: analyticsLoading, isError: analyticsError } = useAnalytics();
  const { data: usage, isLoading: usageLoading, isError: usageError } = useMiniAppUsage(30);
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
  const maxChartValue = chartData.reduce((max, point) => Math.max(max, point.gas), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        <p className="text-gray-600 dark:text-gray-400">Platform usage and metrics</p>
      </div>

      {analyticsError && (
        <div role="alert" className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
          Failed to load analytics data. Please try again later.
        </div>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
              {analyticsLoading ? "..." : formatNumber(analytics?.totalUsers || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Total MiniApps</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
              {analyticsLoading ? "..." : formatNumber(analytics?.totalMiniApps || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Transactions</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
              {analyticsLoading ? "..." : formatNumber(analytics?.totalTransactions || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">GAS Used Today</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
              {analyticsLoading ? "..." : formatNumber(analytics?.gasUsageToday || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {usageError && (
        <div role="alert" className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
          Failed to load usage data. Please try again later.
        </div>
      )}

      {/* Usage Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Over Time (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {usageLoading ? (
            <Spinner />
          ) : chartData.length === 0 ? (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-8 text-center">
              <p className="text-gray-600 dark:text-gray-400">No usage data available yet.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
              <div className="flex h-40 items-end gap-2">
                {chartData.map((point) => {
                  const heightPercent = maxChartValue > 0 ? Math.max((point.gas / maxChartValue) * 100, 4) : 4;
                  return (
                    <div key={point.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t bg-emerald-500"
                        style={{ height: `${heightPercent}%` }}
                        title={`${point.date}: ${formatNumber(point.gas)}`}
                      />
                      <span className="w-full truncate text-center text-[10px] text-gray-500 dark:text-gray-400">{point.date.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage by App */}
      <Card>
        <CardHeader>
          <CardTitle>Usage by MiniApp</CardTitle>
        </CardHeader>
        <CardContent>
          {analyticsLoading ? (
            <Spinner />
          ) : (
            <div className="space-y-3">
              {analytics?.usageByApp?.slice(0, 10).map((app) => (
                <div key={app.app_id} className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{app.app_id}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{app.user_count} users</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">GAS: {formatNumber(app.total_gas)}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">GOV: {formatNumber(app.total_governance)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
