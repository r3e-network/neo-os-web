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
    <div className={cn("w-full", className)}>
      <div className="glass-panel rounded-[2.5rem] p-6 sm:p-10 relative overflow-hidden group hover:shadow-[0_0_80px_rgba(0,229,153,0.15)] transition-shadow duration-700">
        <div className="absolute top-0 right-1/4 w-64 h-64 bg-neo/5 blur-[80px] rounded-full pointer-events-none group-hover:bg-neo/10 transition-colors" />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-[#7000FF]/5 blur-[80px] rounded-full pointer-events-none group-hover:bg-[#7000FF]/10 transition-colors" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10 relative z-10">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="relative text-center md:text-left flex flex-col items-center md:items-start group/stat">
                {index > 0 && (
                  <div className="hidden md:block absolute -left-5 top-1/2 -translate-y-1/2 h-16 w-px bg-gradient-to-b from-transparent via-gray-300 dark:via-white/10 to-transparent" />
                )}
                <div className="flex flex-col md:flex-row items-center gap-5">
                  {Icon && (
                    <div className="flex-shrink-0 h-14 w-14 rounded-2xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-700 dark:text-gray-300 group-hover/stat:bg-neo group-hover/stat:text-dark-950 group-hover/stat:border-neo group-hover/stat:scale-110 group-hover/stat:rotate-3 transition-all duration-300 shadow-sm relative overflow-hidden">
                      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/stat:translate-y-0 transition-transform duration-300" />
                      <Icon size={24} aria-hidden="true" className="relative z-10" />
                    </div>
                  )}
                  <div className="flex flex-col">
                    <p className="text-sm uppercase tracking-widest text-gray-500 dark:text-gray-400 font-bold mb-1 group-hover/stat:text-neo transition-colors">
                      {stat.label}
                    </p>
                    <p className="text-3xl lg:text-4xl font-black text-gray-900 dark:text-white tracking-tighter drop-shadow-sm">{stat.value}</p>
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
