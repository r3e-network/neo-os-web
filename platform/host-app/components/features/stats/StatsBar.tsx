"use client";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatItem {
  label: string;
  value: string;
  icon?: LucideIcon;
  change?: string;
}

interface StatsBarProps {
  stats: StatItem[];
  className?: string;
}

export function StatsBar({ stats, className }: StatsBarProps) {
  return (
    <div className={cn("mx-auto max-w-7xl px-4", className)}>
      <div className="shadow-2xl shadow-neo/5 rounded-[2rem] p-8 border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="relative group text-center md:text-left">
                {index > 0 && (
                  <div className="hidden md:block absolute -left-4 top-1/2 -translate-y-1/2 h-10 w-px bg-gray-300 dark:bg-gray-700" />
                )}
                <div className="flex flex-col md:flex-row items-center gap-4">
                  {Icon && (
                    <div className="h-10 w-10 rounded-xl bg-neo/10 flex items-center justify-center text-neo group-hover:bg-neo group-hover:text-gray-900 transition-colors duration-300">
                      <Icon size={20} />
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400 font-bold mb-1">
                      {stat.label}
                    </p>
                    <p className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">{stat.value}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
