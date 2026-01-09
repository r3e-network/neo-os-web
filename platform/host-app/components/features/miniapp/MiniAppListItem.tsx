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
      href={{
        pathname: `/miniapps/${app.app_id}`,
        query: typeof window !== "undefined" ? window.location.search.substring(1) : "",
      }}
      className="block bg-white dark:bg-[#080808]/80 backdrop-blur-xl border border-gray-200 dark:border-white/5 rounded-[20px] hover:bg-white/5 dark:hover:bg-white/[0.08] hover:border-[rgba(159,157,243,0.4)] transition-all duration-300 hover:shadow-[0_0_20px_rgba(159,157,243,0.2)] hover:-translate-y-1 group mb-3"
    >
      <div className="flex items-center gap-6 px-6 py-4">
        {/* Logo */}
        <MiniAppLogo appId={app.app_id} category={app.category} size="sm" />

        {/* Content Grid */}
        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-6 items-center">
          {/* Main Info */}
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-neo transition-colors">
                {appName}
              </h3>
              <Badge
                variant="secondary"
                className="text-[10px] font-medium uppercase px-2.5 py-0.5 rounded-full border border-gray-300 dark:border-white/10 bg-gray-200 dark:bg-white/5 backdrop-blur-md text-gray-700 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-white transition-colors h-5"
              >
                {categoryLabel}
              </Badge>
            </div>
            <p className="text-sm font-light text-gray-500 dark:text-gray-400 truncate tracking-wide group-hover:text-gray-700 dark:group-hover:text-gray-300">
              {appDesc}
            </p>
          </div>

          {/* Stats */}
          <div className="hidden sm:flex items-center gap-8 text-[11px] font-bold uppercase text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-2 group-hover:text-neo transition-colors" title="Active Users">
              <Globe size={16} strokeWidth={2.5} className="text-neo/70 group-hover:text-neo transition-colors" />
              <span>{formatNumber(app.stats?.users)}</span>
            </div>
            <div
              className="flex items-center gap-2 group-hover:text-electric-purple transition-colors"
              title="Transactions"
            >
              <Zap
                size={16}
                strokeWidth={2.5}
                className="text-electric-purple/70 group-hover:text-electric-purple transition-colors"
              />
              <span>{formatNumber(app.stats?.transactions)}</span>
            </div>
            <div
              className="flex items-center gap-2 w-24 justify-end font-medium opacity-60 group-hover:opacity-100 transition-opacity"
              title="Updated"
            >
              <span>{formatTimeAgo()}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
