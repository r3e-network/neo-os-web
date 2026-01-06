import React from "react";
import { MiniAppInfo, MiniAppStats } from "./types";

type Props = {
  app: MiniAppInfo;
  stats?: MiniAppStats;
  onClick: () => void;
};

export function MiniAppCard({ app, stats, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className="brutal-card p-5 cursor-pointer flex flex-col relative group overflow-hidden"
    >
      <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-300">
        {app.icon}
      </div>
      <div className="flex-1">
        <h3 className="text-lg font-black mb-2 uppercase tracking-tight">
          {app.name}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
          {app.description}
        </p>

        {stats && (
          <div className="flex gap-4 mt-4 font-mono text-[10px] font-bold uppercase tracking-wider text-neo dark:text-neo">
            <span className="bg-black/5 dark:bg-white/5 px-2 py-1 rounded border border-black/10 dark:border-white/10">
              📊 {stats.total_transactions} TXS
            </span>
            <span className="bg-black/5 dark:bg-white/5 px-2 py-1 rounded border border-black/10 dark:border-white/10">
              👥 {stats.total_users} USERS
            </span>
          </div>
        )}
      </div>

      <span className="absolute top-3 right-3 text-[10px] font-black px-2 py-1 bg-brutal-yellow text-black border-2 border-black uppercase tracking-tighter">
        {app.category}
      </span>

      {/* Decorative corner element */}
      <div className="absolute -bottom-4 -right-4 w-8 h-8 bg-neo/10 rotate-45 group-hover:bg-neo/20 transition-colors" />
    </div>
  );
}
