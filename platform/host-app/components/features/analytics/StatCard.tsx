"use client";

import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: React.ReactNode;
}

export function StatCard({ title, value, change, icon }: StatCardProps) {
  const isPositive = change && change > 0;

  return (
    <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 uppercase">{title}</span>
        {icon && <span className="text-gray-400">{icon}</span>}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      {change !== undefined && (
        <div className={`flex items-center gap-1 mt-1 text-xs ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
          {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span>{Math.abs(change)}% vs last week</span>
        </div>
      )}
    </div>
  );
}
