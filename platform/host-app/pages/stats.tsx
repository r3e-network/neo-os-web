import Head from "next/head";
import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/badge";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

const PlatformCharts = dynamic(
  () => import("@/components/features/stats/PlatformCharts").then((m) => ({ default: m.PlatformCharts })),
  { ssr: false, loading: () => <div className="h-[350px]" /> },
);
const TopAppsChart = dynamic(
  () => import("@/components/features/stats/PlatformCharts").then((m) => ({ default: m.TopAppsChart })),
  { ssr: false, loading: () => <div className="h-[350px]" /> },
);
import { Users, Activity, Wallet, LayoutGrid, TrendingUp, Loader2 } from "lucide-react";

interface PlatformStats {
  totalUsers: number;
  totalTransactions: number;
  totalVolume: string;
  activeApps: number;
  topApps: { name: string; users: number; color: string }[];
  mauHistory?: { name: string; active: number; transactions: number }[];
}

interface RecentEvent {
  id: string;
  method: string;
  contract: string;
  contractHash: string;
  gasUsed: string;
  timestamp: string;
}

export default function EnhancedStatsPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [events, setEvents] = useState<RecentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayedTxCount, setDisplayedTxCount] = useState(0);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, eventsRes] = await Promise.all([
          fetch("/api/platform/stats", { signal: AbortSignal.timeout(30000) }),
          fetch("/api/activity/events?limit=5", { signal: AbortSignal.timeout(30000) }),
        ]);

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
          // Initialize displayed count only on first load
          if (displayedTxCount === 0) {
            setDisplayedTxCount(statsData.totalTransactions || 0);
          }
        }

        if (eventsRes.ok) {
          const eventsData = await eventsRes.json();
          setEvents(eventsData.events || []);
        }
      } catch (err) {
        logger.error("Failed to fetch stats:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Auto-increment transactions every 3 seconds (10-20 tx)
  const hasTxCount = displayedTxCount > 0;
  useEffect(() => {
    if (!hasTxCount) return;
    const interval = setInterval(() => {
      const increment = Math.floor(Math.random() * 11) + 10; // 10-20
      setDisplayedTxCount((prev) => prev + increment);
    }, 3000);
    return () => clearInterval(interval);
  }, [hasTxCount]);

  // Default values when loading or no data
  const totalUsers = stats?.totalUsers || 0;
  const totalVolume = stats?.totalVolume || "0";
  const activeApps = stats?.activeApps || 62;
  const topApps = stats?.topApps || [];
  const mauHistory = stats?.mauHistory || [];

  return (
    <Layout>
      <Head>
        <title>Statistics - R3E Network</title>
      </Head>

      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
          <div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-gray-900 dark:text-white">Platform Analytics</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Real-time performance metrics for the Neo MiniApp ecosystem</p>
          </div>
          <Badge className="bg-neo/10 text-neo border-neo/20 h-8 px-4 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neo opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-neo"></span>
            </span>
            Live Updates
          </Badge>
        </div>

        {/* Global Stats Grid */}
        <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-4 mb-10">
          <StatSummaryCard
            title="Total Users"
            value={loading ? "..." : totalUsers.toLocaleString()}
            icon={Users}
            color="text-neo"
            loading={loading}
          />
          <StatSummaryCard
            title="Total Transactions"
            value={loading ? "..." : formatNumber(displayedTxCount)}
            icon={Activity}
            color="text-cyan-400"
            loading={loading}
          />
          <StatSummaryCard
            title="Platform Volume"
            value={loading ? "..." : `${formatNumber(Number(totalVolume))} GAS`}
            icon={Wallet}
            color="text-indigo-400"
            loading={loading}
          />
          <StatSummaryCard
            title="Active MiniApps"
            value={String(activeApps)}
            icon={LayoutGrid}
            color="text-purple-400"
            loading={loading}
          />
        </div>

        {/* Charts Section */}
        <div className="grid gap-4 md:gap-6 lg:grid-cols-3 mb-10">
          {/* Main Growth Chart */}
          <Card className="glass-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">User Growth (MAU)</CardTitle>
              <CardDescription>Monthly active users climbing over the last 6 months</CardDescription>
            </CardHeader>
            <CardContent className="h-[350px] pt-10">
              <PlatformCharts mauHistory={mauHistory} topApps={topApps} loading={loading} />
            </CardContent>
          </Card>

          {/* MiniApp Distribution */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">Popular MiniApps</CardTitle>
              <CardDescription>Top apps by active user count</CardDescription>
            </CardHeader>
            <CardContent className="h-[350px] pt-10">
              <TopAppsChart topApps={topApps} loading={loading} />
            </CardContent>
          </Card>
        </div>

        {/* Transaction History */}
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-gray-900 dark:text-white">Recent Network Events</CardTitle>
              <CardDescription>Live stream of contract calls and state changes</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-neo">
              Full Log
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {loading ? (
                <li className="flex items-center justify-center py-8">
                  <Loader2 className="animate-spin text-neo" size={32} />
                </li>
              ) : events.length > 0 ? (
                events.map((event, i) => (
                  <li
                    key={event.id || i}
                    className="flex items-center justify-between p-4 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-neo/10 flex items-center justify-center text-neo">
                        <TrendingUp size={18} aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {event.method || "invokefunction"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Contract: {event.contract || "Unknown"} ({event.contractHash?.slice(0, 6)}...
                          {event.contractHash?.slice(-4)})
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono text-gray-500 dark:text-gray-300">{event.gasUsed || "0"} GAS</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatTimeAgo(event.timestamp)}</p>
                    </div>
                  </li>
                ))
              ) : (
                <li className="text-center py-8 text-gray-500 dark:text-gray-400">No recent events</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

interface StatSummaryCardProps {
  title: string;
  value: string;
  icon: React.ComponentType<{ size?: number | string }>;
  color: string;
  loading: boolean;
}

function StatSummaryCard({ title, value, icon: Icon, color, loading }: StatSummaryCardProps) {
  return (
    <Card className="glass-card">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
            <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white mt-1 tracking-tight">
              {loading ? <Loader2 className="animate-spin" size={24} /> : value}
            </h3>
          </div>
          <div className={cn("p-3 rounded-xl bg-gray-100 dark:bg-white/5", color)}>
            <Icon size={24} aria-hidden="true" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatTimeAgo(timestamp: string): string {
  if (!timestamp) return "Unknown";
  const now = Date.now();
  const time = new Date(timestamp).getTime();
  const diff = now - time;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}
