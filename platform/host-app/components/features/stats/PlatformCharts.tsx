"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Cell,
} from "recharts";
import { Loader2 } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";

interface PlatformChartsProps {
  mauHistory: { name: string; active: number; transactions: number }[];
  topApps: { name: string; users: number; color: string }[];
  loading: boolean;
}

export function PlatformCharts({ mauHistory, topApps, loading }: PlatformChartsProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <>
      {/* MAU Growth Chart */}
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="animate-spin text-neo" size={32} />
        </div>
      ) : mauHistory.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={mauHistory}>
            <defs>
              <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#1e293b" : "#e5e7eb"} />
            <XAxis dataKey="name" stroke={isDark ? "#64748b" : "#94a3b8"} fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke={isDark ? "#64748b" : "#94a3b8"} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000}k`} />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#0f172a" : "rgba(255, 255, 255, 0.95)",
                border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)",
                borderRadius: "8px",
                color: isDark ? "#e5e7eb" : "#1f2937",
              }}
              itemStyle={{ color: "#00d4aa" }}
            />
            <Area type="monotone" dataKey="active" stroke="#00d4aa" fillOpacity={1} fill="url(#colorActive)" strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-full text-slate-500">No historical data available</div>
      )}
    </>
  );
}

export function TopAppsChart({ topApps, loading }: Omit<PlatformChartsProps, "mauHistory">) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-neo" size={32} />
      </div>
    );
  }
  if (topApps.length === 0) {
    return <div className="flex items-center justify-center h-full text-slate-500">No app data available</div>;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={topApps} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? "#1e293b" : "#e5e7eb"} />
        <XAxis type="number" hide />
        <YAxis dataKey="name" type="category" stroke={isDark ? "#64748b" : "#94a3b8"} fontSize={10} width={80} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }}
          contentStyle={{
            backgroundColor: isDark ? "#0f172a" : "rgba(255, 255, 255, 0.95)",
            border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)",
            borderRadius: "8px",
            color: isDark ? "#e5e7eb" : "#1f2937",
          }}
        />
        <Bar dataKey="users" radius={[0, 4, 4, 0]}>
          {topApps.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
