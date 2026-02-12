// =============================================================================
// Analytics Page
// =============================================================================

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { useAnalytics, useMiniAppUsage } from "@/lib/hooks/useAnalytics";
import { formatNumber } from "@/lib/utils";

export default function AnalyticsPage() {
  const { data: analytics, isLoading: analyticsLoading } = useAnalytics();
  const { data: usage, isLoading: usageLoading } = useMiniAppUsage(30);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-muted-foreground">Platform usage and metrics</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm font-medium">Total Users</div>
            <div className="mt-2 text-3xl font-semibold text-foreground">
              {analyticsLoading ? "..." : formatNumber(analytics?.totalUsers || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm font-medium">Total MiniApps</div>
            <div className="mt-2 text-3xl font-semibold text-foreground">
              {analyticsLoading ? "..." : formatNumber(analytics?.totalMiniApps || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm font-medium">Total Transactions</div>
            <div className="mt-2 text-3xl font-semibold text-foreground">
              {analyticsLoading ? "..." : formatNumber(analytics?.totalTransactions || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm font-medium">GAS Used Today</div>
            <div className="mt-2 text-3xl font-semibold text-foreground">
              {analyticsLoading ? "..." : formatNumber(analytics?.gasUsageToday || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Over Time (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {usageLoading ? (
            <Spinner />
          ) : (
            <div className="border-border/20 bg-muted/30 rounded-lg border p-8 text-center">
              <p className="text-muted-foreground">{usage?.length || 0} data points available</p>
              <p className="text-muted-foreground mt-2 text-sm">Chart visualization requires recharts integration</p>
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
              {analytics?.usageByApp?.length ? (
                analytics.usageByApp.slice(0, 10).map((app) => (
                  <div key={app.app_id} className="border-border/10 flex items-center justify-between border-b pb-3">
                    <div>
                      <div className="font-medium text-foreground">{app.app_id}</div>
                      <div className="text-muted-foreground text-sm">{app.user_count} users</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-foreground">GAS: {formatNumber(app.total_gas)}</div>
                      <div className="text-muted-foreground text-sm">GOV: {formatNumber(app.total_governance)}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground py-8 text-center">No usage data available</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
