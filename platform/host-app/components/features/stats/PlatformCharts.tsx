"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Cell,
} from "recharts";
import { Loader2 } from "lucide-react";

interface PlatformChartsProps {
  mauHistory: { name: string; active: number; transactions: number }[];
  topApps: { name: string; users: number; color: string }[];
  loading: boolean;
}

export function PlatformCharts({ mauHistory, topApps, loading }: PlatformChartsProps) {
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
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
            <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000}k`} />
            <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }} itemStyle={{ color: "#00d4aa" }} />
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
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1e293b" />
        <XAxis type="number" hide />
        <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={80} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: "rgba(255,255,255,0.05)" }} contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }} />
        <Bar dataKey="users" radius={[0, 4, 4, 0]}>
          {topApps.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
