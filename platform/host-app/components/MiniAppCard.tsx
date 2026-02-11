import React from "react";
import type { MiniAppInfo, MiniAppStats } from "./types";
import { Badge } from "@/components/ui/badge";

type Props = {
  app: MiniAppInfo;
  stats?: MiniAppStats;
  onClick: () => void;
};

export function MiniAppCard({ app, stats, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className="h-full group relative flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-white/5 backdrop-blur-sm border border-gray-200 dark:border-white/10 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-neo/40 cursor-pointer"
    >
      {/* Banner Section */}
      <div className="h-32 w-full relative overflow-hidden bg-gray-100 dark:bg-white/5 border-b border-gray-100 dark:border-white/5">
        {app.banner ? (
          <img
            src={app.banner}
            alt={`${app.name} banner`}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              e.currentTarget.parentElement?.classList.add("bg-gradient-to-br", "from-neo/10", "to-purple-500/10");
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-neo/10 to-purple-500/10" />
        )}

        {/* Category Badge - Floating top right */}
        <div className="absolute top-3 right-3">
          <Badge className="uppercase tracking-wide text-[10px] font-bold px-2 py-0.5 bg-white/90 dark:bg-black/60 text-gray-900 dark:text-white border border-transparent backdrop-blur-md rounded-full shadow-sm">
            {app.category}
          </Badge>
        </div>
      </div>

      <div className="p-5 pt-0 flex flex-col flex-1">
        {/* App Icon - Overlapping Banner */}
        <div className="-mt-9 mb-3 relative z-10 w-16 h-16 rounded-xl bg-white dark:bg-erobo-bg-card border-[3px] border-white dark:border-erobo-bg-card shadow-md overflow-hidden group-hover:scale-105 transition-transform duration-300">
          {app.icon && (app.icon.startsWith("/") || app.icon.startsWith("http")) ? (
            <img src={app.icon} alt="icon" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl">{app.icon}</div>
          )}
        </div>

        <div className="flex-1">
          <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white group-hover:text-neo transition-colors line-clamp-1">
            {app.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed min-h-[40px]">
            {app.description}
          </p>

          {stats && (
            <div className="flex gap-2 mt-4 flex-wrap">
              <Badge
                variant="outline"
                className="text-[10px] font-mono font-medium text-gray-500 border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20"
              >
                <span suppressHydrationWarning>📊 {stats.total_transactions} TXS</span>
              </Badge>
              <Badge
                variant="outline"
                className="text-[10px] font-mono font-medium text-gray-500 border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20"
              >
                <span suppressHydrationWarning>👥 {stats.total_users} USERS</span>
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Decorative gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-tr from-neo/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  );
}
