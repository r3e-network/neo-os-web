"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface ActivityChartProps {
  data: { date: string; txCount: number; volume: string }[];
  height?: number;
}

export function ActivityChart({ data, height = 200 }: ActivityChartProps) {
  const chartData = data.map((d) => ({
    date: d.date.slice(5), // MM-DD format
    transactions: d.txCount,
    volume: parseFloat(d.volume),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorTx" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(17, 24, 39, 0.9)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px",
            fontSize: "12px",
          }}
        />
        <Area type="monotone" dataKey="transactions" stroke="#10b981" fill="url(#colorTx)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
