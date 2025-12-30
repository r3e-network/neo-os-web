"use client";

import Head from "next/head";
import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Wallet, LayoutGrid, Clock } from "lucide-react";
import { useWalletStore } from "@/lib/wallet/store";
import { ActivityChart, AppUsageChart, StatCard } from "@/components/features/analytics";
import type { UserAnalytics } from "@/pages/api/analytics/user";

export default function AnalyticsPage() {
  const { address } = useWalletStore();
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }
    fetchAnalytics(address);
  }, [address]);

  const fetchAnalytics = async (wallet: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/user?wallet=${wallet}`);
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  if (!address) {
    return (
      <Layout>
        <Head>
          <title>Analytics - NeoHub</title>
        </Head>
        <div className="mx-auto max-w-4xl px-4 py-12 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Connect Wallet</h1>
          <p className="text-gray-500">Connect your wallet to view your analytics</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Head>
        <title>Analytics - NeoHub</title>
      </Head>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Your Analytics</h1>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : analytics ? (
          <AnalyticsDashboard analytics={analytics} />
        ) : (
          <div className="text-center py-12 text-gray-500">No data available</div>
        )}
      </div>
    </Layout>
  );
}

function AnalyticsDashboard({ analytics }: { analytics: UserAnalytics }) {
  const { summary, activity, appBreakdown } = analytics;

  return (
    <div className="space-y-8">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Transactions" value={summary.totalTx} change={12} icon={<Activity size={16} />} />
        <StatCard title="Total Volume" value={`${summary.totalVolume} GAS`} change={8} icon={<Wallet size={16} />} />
        <StatCard title="Apps Used" value={summary.appsUsed} icon={<LayoutGrid size={16} />} />
        <StatCard title="Active Days" value={activity.filter((a) => a.txCount > 0).length} icon={<Clock size={16} />} />
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-sm text-gray-900 dark:text-white">Activity (30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityChart data={activity} height={220} />
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-sm text-gray-900 dark:text-white">App Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <AppUsageChart data={appBreakdown} height={180} />
              <AppLegend apps={appBreakdown} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* App Breakdown Table */}
      <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-sm text-gray-900 dark:text-white">App Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <AppBreakdownTable apps={appBreakdown} />
        </CardContent>
      </Card>
    </div>
  );
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

function AppLegend({ apps }: { apps: { appName: string; txCount: number }[] }) {
  return (
    <div className="space-y-2">
      {apps.map((app, i) => (
        <div key={app.appName} className="flex items-center gap-2 text-xs">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
          <span className="text-gray-600 dark:text-gray-400">{app.appName}</span>
        </div>
      ))}
    </div>
  );
}

function AppBreakdownTable({
  apps,
}: {
  apps: { appId: string; appName: string; txCount: number; volume: string; lastUsed: string }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-2 text-gray-500 font-medium">App</th>
            <th className="text-right py-2 text-gray-500 font-medium">Transactions</th>
            <th className="text-right py-2 text-gray-500 font-medium">Volume</th>
            <th className="text-right py-2 text-gray-500 font-medium">Last Used</th>
          </tr>
        </thead>
        <tbody>
          {apps.map((app) => (
            <tr key={app.appId} className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-3 text-gray-900 dark:text-white">{app.appName}</td>
              <td className="py-3 text-right text-gray-600 dark:text-gray-400">{app.txCount}</td>
              <td className="py-3 text-right text-gray-600 dark:text-gray-400">{app.volume} GAS</td>
              <td className="py-3 text-right text-gray-500 text-xs">{new Date(app.lastUsed).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
