"use client";

import Link from "next/link";
import { Globe, Zap } from "lucide-react";
import { MiniAppLogo } from "./MiniAppLogo";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n/react";
import type { MiniAppInfo } from "./MiniAppCard";

interface MiniAppListItemProps {
  app: MiniAppInfo;
}

function formatNumber(num?: number): string {
  if (!num) return "0";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
}

function formatTimeAgo(date?: string): string {
  if (!date) return "Recently";
  const now = new Date();
  const then = new Date(date);
  const diff = now.getTime() - then.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function MiniAppListItem({ app }: MiniAppListItemProps) {
  const { t, locale } = useTranslation("host");
  const categoryLabel = t(`categories.${app.category}`) || app.category;

  // Self-contained i18n: use MiniApp's own translations based on locale
  const appName = locale === "zh" && app.name_zh ? app.name_zh : app.name;
  const appDesc = locale === "zh" && app.description_zh ? app.description_zh : app.description;

  return (
    <Link
      href={`/miniapps/${app.app_id}`}
      className="group block border-b-4 border-black dark:border-white bg-white dark:bg-black hover:bg-brutal-yellow transition-colors duration-200"
    >
      <div className="flex items-center gap-6 px-6 py-4">
        {/* Logo */}
        <div className="shrink-0 group-hover:scale-110 transition-transform duration-200">
          <MiniAppLogo appId={app.app_id} category={app.category} size="sm" />
        </div>

        {/* Content Grid */}
        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-6 items-center">
          {/* Main Info */}
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="font-black text-black dark:text-white uppercase tracking-tighter italic group-hover:text-black transition-colors text-lg">
                {appName}
              </h3>
              <Badge variant="secondary" className="text-[9px] font-black uppercase px-2 py-0 border border-black shadow-brutal-xs bg-white text-black group-hover:bg-black group-hover:text-white transition-colors rounded-none h-5">
                {categoryLabel}
              </Badge>
            </div>
            <p className="text-xs font-bold text-gray-600 dark:text-gray-300 truncate tracking-tight group-hover:text-black">{appDesc}</p>
          </div>

          {/* Stats */}
          <div className="hidden sm:flex items-center gap-8 text-[11px] font-black uppercase text-black dark:text-white">
            <div className="flex items-center gap-2" title="Active Users">
              <Globe size={16} strokeWidth={2.5} className="text-black dark:text-white" />
              <span>{formatNumber(app.stats?.users)}</span>
            </div>
            <div className="flex items-center gap-2" title="Transactions">
              <Zap size={16} strokeWidth={2.5} className="text-black dark:text-white" />
              <span>{formatNumber(app.stats?.transactions)}</span>
            </div>
            <div className="flex items-center gap-2 w-24 justify-end italic opacity-60 group-hover:opacity-100 group-hover:text-black" title="Updated">
              <span>{formatTimeAgo()}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
