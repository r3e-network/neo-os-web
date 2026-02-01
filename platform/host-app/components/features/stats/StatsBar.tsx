"use client";
import type { LucideIcon } from "lucide-react";
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
      <div className="erobo-card p-8 rounded-[28px] backdrop-blur-2xl bg-white/5 dark:bg-black/10 border border-white/20 dark:border-white/5 shadow-2xl">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-12">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="relative group overflow-visible">
                {index > 0 && (
                  <div className="hidden lg:block absolute -left-6 top-1/2 -translate-y-1/2 h-16 w-[1px] bg-gradient-to-b from-transparent via-erobo-purple/20 dark:via-white/10 to-transparent" />
                )}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                  {Icon && (
                    <div className="h-14 w-14 rounded-full bg-erobo-sky/20 dark:bg-white/5 border border-white/30 dark:border-white/10 flex items-center justify-center text-erobo-purple shadow-[0_0_20px_rgba(159,157,243,0.2)] group-hover:scale-110 transition-transform flex-shrink-0 backdrop-blur-md">
                      <Icon size={24} strokeWidth={2.5} />
                    </div>
                  )}
                  <div className="flex flex-col items-center sm:items-start">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-erobo-ink-soft/70 dark:text-white/50 mb-1">
                      {stat.label}
                    </p>
                    <p className="text-3xl font-bold text-erobo-ink dark:text-white tracking-tight">{stat.value}</p>
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
