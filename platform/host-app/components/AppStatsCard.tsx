type Props = {
  title: string;
  value: string | number;
  icon: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
};

export function AppStatsCard({ title, value, icon, trend, trendValue }: Props) {
  const trendColor =
    trend === "up" ? "text-neo" : trend === "down" ? "text-red-500" : "text-gray-500 dark:text-gray-400";

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/80 p-5 shadow-sm dark:shadow-lg">
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {title}
        </span>
      </div>
      <div className="text-[32px] font-bold leading-none text-gray-900 dark:text-white">{value}</div>
      {trendValue && (
        <div className={`text-xs font-semibold ${trendColor}`} aria-label={`${trend === "up" ? "Increase" : trend === "down" ? "Decrease" : "No change"} ${trendValue}`}>
          {trend === "up" ? "↑" : trend === "down" ? "↓" : ""} {trendValue}
        </div>
      )}
    </div>
  );
}
