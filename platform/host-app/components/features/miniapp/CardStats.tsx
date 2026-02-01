"use client";

import { Users, Activity, Eye, Star } from "lucide-react";
import { formatNumber } from "@/lib/utils";

export interface StatItemProps {
  icon: React.ReactNode;
  value: number | undefined;
  label: string;
  iconBgClass?: string;
}

export function StatItem({ icon, value, label, iconBgClass = "bg-erobo-purple/10" }: StatItemProps) {
  return (
    <div className="flex items-center gap-1.5" title={label}>
      <div className={`p-1 rounded-full ${iconBgClass}`}>{icon}</div>
      <div className="flex flex-col">
        <span suppressHydrationWarning className="text-xs font-bold text-erobo-ink dark:text-gray-200 leading-none">
          {formatNumber(value)}
        </span>
        <span className="text-[9px] text-erobo-ink-soft/60 uppercase font-medium leading-none mt-0.5">{label}</span>
      </div>
    </div>
  );
}

export interface CardStatsProps {
  users?: number;
  transactions?: number;
  views?: number;
  className?: string;
}

export function CardStats({ users, transactions, views, className = "" }: CardStatsProps) {
  const dividerClass = "w-px h-6 bg-gradient-to-b from-transparent via-erobo-purple/10 to-transparent mx-2";

  return (
    <div
      className={`flex items-center justify-between py-3 border-t border-erobo-purple/10 dark:border-white/5 mt-auto bg-transparent px-1 ${className}`}
    >
      <StatItem
        icon={<Users size={12} className="text-erobo-purple" strokeWidth={2.5} />}
        value={users}
        label="Users"
        iconBgClass="bg-erobo-purple/10"
      />

      <div className={dividerClass} />

      <StatItem
        icon={<Activity size={12} className="text-erobo-pink" strokeWidth={2.5} />}
        value={transactions}
        label="TXs"
        iconBgClass="bg-erobo-pink/10"
      />

      <div className={dividerClass} />

      <StatItem
        icon={<Eye size={12} className="text-erobo-sky" strokeWidth={2.5} />}
        value={views}
        label="Views"
        iconBgClass="bg-erobo-sky/10"
      />
    </div>
  );
}

export interface RatingBadgeProps {
  rating: number;
}

export function RatingBadge({ rating }: RatingBadgeProps) {
  return (
    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-yellow-400/10 border border-yellow-400/20">
      <Star size={9} className="text-yellow-400 fill-yellow-400" />
      <span
        suppressHydrationWarning
        className="text-[10px] font-bold text-yellow-600 dark:text-yellow-400 leading-none"
      >
        {rating.toFixed(1)}
      </span>
    </div>
  );
}
