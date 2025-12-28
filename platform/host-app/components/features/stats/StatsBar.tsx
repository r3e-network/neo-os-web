"use client";

interface StatItem {
  label: string;
  value: string;
  change?: string;
}

interface StatsBarProps {
  stats: StatItem[];
}

export function StatsBar({ stats }: StatsBarProps) {
  return (
    <div className="bg-gray-900 py-4">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex items-center justify-between gap-8 overflow-x-auto">
          {stats.map((stat, index) => (
            <div key={index} className="flex flex-col items-center min-w-fit">
              <span className="text-2xl font-bold text-white">{stat.value}</span>
              <span className="text-xs text-gray-400">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
