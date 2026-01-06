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
    <div className={cn("mx-auto max-w-[1600px]", className)}>
      <div className="bg-white dark:bg-black border-4 border-black dark:border-white shadow-brutal-lg p-8 rounded-none">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-12">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="relative group overflow-visible">
                {index > 0 && (
                  <div className="hidden lg:block absolute -left-6 top-1/2 -translate-y-1/2 h-16 w-1 bg-black dark:bg-white rotate-12" />
                )}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                  {Icon && (
                    <div className="h-14 w-14 rounded-none bg-neo border-4 border-black shadow-brutal-xs flex items-center justify-center text-black rotate-2 group-hover:rotate-0 transition-transform flex-shrink-0">
                      <Icon size={24} strokeWidth={3} />
                    </div>
                  )}
                  <div className="flex flex-col items-center sm:items-start">
                    <p className="text-[10px] font-black uppercase tracking-widest text-black/40 dark:text-white/40 mb-1 italic">
                      {stat.label}
                    </p>
                    <p className="text-3xl font-black text-black dark:text-white tracking-tighter italic">
                      {stat.value}
                    </p>
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
