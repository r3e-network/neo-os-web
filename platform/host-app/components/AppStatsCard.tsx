import React from "react";

type Props = {
  title: string;
  value: string | number;
  icon: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
};

export function AppStatsCard({ title, value, icon, trend, trendValue }: Props) {
  const getTrendSymbol = () => {
    if (trend === "up") return "↑";
    if (trend === "down") return "↓";
    return "•";
  };

  return (
    <div className="erobo-card p-5 rounded-[24px] hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-erobo-purple/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div className="text-xl bg-white/80 dark:bg-white/10 p-2.5 rounded-xl text-erobo-ink dark:text-slate-200 transition-transform group-hover:scale-110 shadow-sm">
            {icon}
          </div>
          {trendValue && (
            <div
              className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm ${trend === 'up' ? 'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400 border border-green-100 dark:border-green-500/20' :
                  trend === 'down' ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 border border-red-100 dark:border-red-500/20' :
                    'bg-white/70 text-erobo-ink-soft/70 dark:bg-white/5 dark:text-slate-400 border border-white/60 dark:border-white/10'
                }`}
            >
              <span>
                {getTrendSymbol()} {trendValue}
              </span>
            </div>
          )}
        </div>

        <div className="text-3xl font-bold tracking-tight text-erobo-ink dark:text-white mb-1 break-all leading-none font-sans">
          {value}
        </div>

        <div className="inline-block text-xs font-semibold text-erobo-ink-soft/70 dark:text-slate-400 uppercase tracking-widest font-sans">
          {title}
        </div>
      </div>
    </div>
  );
}
