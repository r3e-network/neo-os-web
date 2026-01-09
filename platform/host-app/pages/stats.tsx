import Head from "next/head";
import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell,
} from "recharts";
import { Users, Activity, Wallet, LayoutGrid, TrendingUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const { t } = useTranslation("host");
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [events, setEvents] = useState<RecentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayedTxCount, setDisplayedTxCount] = useState(0);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, eventsRes] = await Promise.all([
          fetch("/api/platform/stats"),
          fetch("/api/activity/events?limit=5"),
        ]);

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
          setDisplayedTxCount(statsData.totalTransactions || 0);
        }

        if (eventsRes.ok) {
          const eventsData = await eventsRes.json();
          setEvents(eventsData.events || []);
        }
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Default values when loading or no data
  const totalUsers = stats?.totalUsers || 0;
  // Use real data or fallback to 0. Do NOT use displayedTxCount for fake increments anymore.
  const totalTransactions = stats?.totalTransactions || 0;
  const totalVolume = stats?.totalVolume || "0";
  const activeApps = stats?.activeApps || 0;
  const topApps = stats?.topApps || [];
  const mauHistory = stats?.mauHistory || [];

  return (
    <Layout>
      <Head>
        <title>{t("statsPage.title")} - NeoHub</title>
      </Head>

      <div className="relative mx-auto max-w-7xl px-4 py-12">
        {/* E-Robo Water Wave Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute w-[200%] h-[200%] top-[-50%] left-[-50%] animate-water-wave opacity-30">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,rgba(159,157,243,0.08)_0%,transparent_70%)]" />
          </div>
        </div>

        <div className="relative flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">{t("statsPage.title")}</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">{t("statsPage.subtitle")}</p>
          </div>
          <Badge className="bg-neo/10 text-neo border border-neo/20 h-8 px-4 flex items-center gap-2 rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neo opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-neo"></span>
            </span>
            {t("statsPage.liveUpdates")}
          </Badge>
        </div>

        {/* Global Stats Grid */}
        <div className="relative grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-10">
          <StatSummaryCard
            title={t("stats.totalUsers")}
            value={loading ? "..." : totalUsers.toLocaleString()}
            icon={Users}
            color="text-emerald-500"
            loading={loading}
          />
          <StatSummaryCard
            title={t("stats.totalTransactions")}
            value={loading ? "..." : formatNumber(totalTransactions)}
            icon={Activity}
            color="text-cyan-400"
            loading={loading}
          />
          <StatSummaryCard
            title={t("stats.totalVolume")}
            value={loading ? "..." : `${formatNumber(Number(totalVolume))} GAS`}
            icon={Wallet}
            color="text-indigo-400"
            loading={loading}
          />
          <StatSummaryCard
            title={t("stats.totalApps")}
            value={String(activeApps)}
            icon={LayoutGrid}
            color="text-purple-400"
            loading={loading}
          />
        </div>

        {/* Charts Section */}
        <div className="relative grid gap-6 lg:grid-cols-3 mb-10">
          {/* Main Growth Chart */}
          <Card className="erobo-card bg-white dark:bg-[#080808]/80 backdrop-blur-xl border border-gray-200 dark:border-erobo-purple/20 shadow-lg rounded-2xl lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">{t("statsPage.monthlyActive")}</CardTitle>
            </CardHeader>
            <CardContent className="h-[350px] pt-10">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="animate-spin text-emerald-500" size={32} />
                </div>
              ) : mauHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mauHistory}>
                    <defs>
                      <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis
                      stroke="#64748b"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value / 1000}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                      }}
                      itemStyle={{ color: "#10b981" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="active"
                      stroke="#10b981"
                      fillOpacity={1}
                      fill="url(#colorActive)"
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">{t("statsPage.noData")}</div>
              )}
            </CardContent>
          </Card>

          {/* MiniApp Distribution */}
          <Card className="erobo-card bg-white dark:bg-[#080808]/80 backdrop-blur-xl border border-gray-200 dark:border-erobo-purple/20 shadow-lg rounded-2xl">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">{t("statsPage.topApps")}</CardTitle>
            </CardHeader>
            <CardContent className="h-[350px] pt-10">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="animate-spin text-emerald-500" size={32} />
                </div>
              ) : topApps.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topApps} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1e293b" />
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="#64748b"
                      fontSize={10}
                      width={80}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.05)" }}
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="users" radius={[0, 4, 4, 0]}>
                      {topApps.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">{t("statsPage.noAppData")}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Transaction History */}
        <Card className="relative erobo-card bg-white dark:bg-[#080808]/80 backdrop-blur-xl border border-gray-200 dark:border-erobo-purple/20 shadow-lg rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-gray-900 dark:text-white">{t("statsPage.recentActivity")}</CardTitle>
              <CardDescription>{t("statsPage.recentActivityDesc")}</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-emerald-500">
              {t("statsPage.fullLog")}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="animate-spin text-emerald-500" size={32} />
                </div>
              ) : events.length > 0 ? (
                events.map((event, i) => (
                  <div
                    key={event.id || i}
                    className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-erobo-purple/10 hover:border-erobo-purple/40 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-erobo-purple/20 to-erobo-purple-dark/20 flex items-center justify-center text-erobo-purple">
                        <TrendingUp size={18} strokeWidth={2} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {event.method || "invokefunction"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t("statsPage.contract")}: {event.contract || "Unknown"} ({event.contractHash?.slice(0, 6)}...
                          {event.contractHash?.slice(-4)})
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono text-gray-700 dark:text-gray-200">{event.gasUsed || "0"} GAS</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">{formatTimeAgo(event.timestamp)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500">{t("statsPage.noEvents")}</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function StatSummaryCard({ title, value, icon: Icon, color, loading }: any) {
  return (
    <Card className="erobo-card bg-white dark:bg-[#080808]/80 backdrop-blur-xl border border-gray-200 dark:border-erobo-purple/20 shadow-lg rounded-2xl transition-all hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(159,157,243,0.3)] hover:border-erobo-purple/40">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{title}</p>
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
              {loading ? <Loader2 className="animate-spin" size={24} /> : value}
            </h3>
          </div>
          <div className="p-3 rounded-xl bg-gradient-to-br from-erobo-purple/10 to-erobo-purple-dark/10 dark:from-erobo-purple/20 dark:to-erobo-purple-dark/20 border border-erobo-purple/20">
            <Icon size={24} className={color} strokeWidth={2} />
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

export const getServerSideProps = async () => ({ props: {} });
