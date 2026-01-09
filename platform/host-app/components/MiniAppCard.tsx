import React from "react";
import { MiniAppInfo, MiniAppStats } from "./types";
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
      className="h-full group relative flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-white/5 backdrop-blur-sm border border-gray-200 dark:border-white/10 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-neo/40 cursor-pointer p-5"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="text-4xl group-hover:scale-110 transition-transform duration-300 drop-shadow-sm">
          {app.icon}
        </div>
        <Badge className="uppercase tracking-wide text-[10px] font-bold px-2 py-0.5 bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-transparent rounded-full">
          {app.category}
        </Badge>
      </div>

      <div className="flex-1">
        <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white group-hover:text-neo transition-colors">
          {app.name}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">{app.description}</p>

        {stats && (
          <div className="flex gap-2 mt-4">
            <Badge
              variant="outline"
              className="text-[10px] font-mono font-medium text-gray-500 border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20"
            >
              📊 {stats.total_transactions} TXS
            </Badge>
            <Badge
              variant="outline"
              className="text-[10px] font-mono font-medium text-gray-500 border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20"
            >
              👥 {stats.total_users} USERS
            </Badge>
          </div>
        )}
      </div>

      {/* Decorative effect */}
      <div className="absolute inset-0 bg-gradient-to-tr from-neo/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  );
}
