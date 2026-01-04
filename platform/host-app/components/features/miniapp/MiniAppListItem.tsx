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
      className="group block border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
    >
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Logo */}
        <div className="shrink-0">
          <MiniAppLogo appId={app.app_id} category={app.category} size="sm" />
        </div>

        {/* Content Grid */}
        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-center">
          {/* Main Info */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-bold text-gray-900 dark:text-white truncate group-hover:text-neo dark:group-hover:text-neo transition-colors">
                {appName}
              </h3>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                {categoryLabel}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{appDesc}</p>
          </div>

          {/* Stats */}
          <div className="hidden sm:flex items-center gap-6 text-xs text-gray-500 dark:text-gray-400 font-mono">
            <div className="flex items-center gap-1.5" title="Users">
              <Globe size={14} className="text-gray-400" />
              <span>{formatNumber(app.stats?.users)}</span>
            </div>
            <div className="flex items-center gap-1.5" title="Transactions">
              <Zap size={14} className="text-gray-400" />
              <span>{formatNumber(app.stats?.transactions)}</span>
            </div>
            <div className="flex items-center gap-1 w-20 justify-end text-gray-400" title="Updated">
              <span>{formatTimeAgo()}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
