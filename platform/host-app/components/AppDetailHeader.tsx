import React from "react";
import Image from "next/image";
import type { MiniAppInfo, MiniAppStats } from "./types";

import { useI18n, useTranslation } from "@/lib/i18n/react";
import { MiniAppLogo } from "./features/miniapp/MiniAppLogo";
import { Badge } from "@/components/ui/badge";
import { ChainBadgeGroup } from "@/components/ui/ChainBadgeGroup";
import { WishlistButton } from "./features/wishlist";
import { Users, Activity, Eye } from "lucide-react";
import { getLocalizedField } from "@neo/shared/i18n";
import type { ChainId } from "@/lib/chains/types";

function isIconUrl(icon: string): boolean {
  if (!icon) return false;
  return icon.startsWith("/") || icon.startsWith("http") || icon.endsWith(".svg") || icon.endsWith(".png");
}

function isBannerUrl(banner: string | undefined): boolean {
  if (!banner) return false;
  return banner.startsWith("/") || banner.startsWith("http") || banner.endsWith(".svg") || banner.endsWith(".png");
}

type Props = {
  app: MiniAppInfo;
  stats?: MiniAppStats;
  onClickBack?: () => void;
  description?: string;
};

export function AppDetailHeader({ app, stats, description }: Props) {
  const { locale } = useI18n();
  const { t } = useTranslation("host");
  const appName = getLocalizedField(app, "name", locale);
  const supportedChains = (app.supportedChains || []) as ChainId[];

  let statusKey: "active" | "inactive" | "online" | "maintenance" | "pending" = stats?.last_activity_at
    ? "active"
    : "inactive";

  if (app.status === "active") {
    statusKey = "online";
  } else if (app.status === "disabled") {
    statusKey = "maintenance";
  } else if (app.status === "pending") {
    statusKey = "pending";
  }

  const statusLabel = t(`detail.status.${statusKey}`);
  const hasBanner = isBannerUrl(app.banner);

  return (
    <header className="relative z-10 overflow-hidden bg-white/70 dark:bg-[#0b0c16]/90 backdrop-blur-xl border-b border-white/60 dark:border-white/10 transition-all duration-300">
      {/* Banner Section - force rebuild 2026-01-19T13:57 */}
      {hasBanner && (
        <div className="relative w-full h-48 overflow-hidden">
          <Image
            src={app.banner as string}
            alt={`${appName} banner`}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
          {/* Gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </div>
      )}

      {/* E-Robo Background Glow (fallback when no banner) */}
      {!hasBanner && (
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-[var(--erobo-purple)]/20 to-transparent rounded-full blur-[100px] pointer-events-none -mr-32 -mt-32 opacity-70" />
      )}

      {/* Main Content */}
      <div className={`px-6 py-6 relative ${hasBanner ? "-mt-16" : "pt-24"}`}>
        {/* Logo and Name Row */}
        <div className="flex items-center gap-5 mb-3">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 group hover:scale-105 transition-transform duration-300 relative z-20 overflow-hidden shadow-xl border-4 border-white/80 dark:border-[#0b0c16]/80">
            {isIconUrl(app.icon) ? (
              <MiniAppLogo
                appId={app.app_id}
                category={app.category}
                size="lg"
                iconUrl={app.icon}
                className="w-full h-full rounded-xl"
              />
            ) : (
              <div className="w-full h-full bg-white/90 dark:bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-xl">
                <span className="text-4xl transition-transform group-hover:scale-110 duration-300 inline-block">
                  {app.icon}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-erobo-ink dark:text-white leading-tight tracking-tight truncate">
              {appName}
            </h1>
          </div>
        </div>

        {/* Status Row */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div
            className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] tracking-wider flex items-center gap-1.5 border shadow-sm backdrop-blur-sm ${statusKey === "online"
              ? "bg-erobo-purple/10 text-erobo-purple border-erobo-purple/30"
              : statusKey === "maintenance"
                ? "bg-erobo-peach/40 text-erobo-ink border-white/60"
                : "bg-white/70 dark:bg-white/5 text-erobo-ink-soft/70 dark:text-gray-400 border-white/60 dark:border-white/10"
              }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${statusKey === "online"
                ? "bg-erobo-purple animate-pulse shadow-[0_0_8px_currentColor]"
                : "bg-current opacity-50"
                }`}
            />
            {statusLabel}
          </div>

          {supportedChains.length > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/50 dark:bg-white/5 rounded-full border border-white/60 dark:border-white/10">
              <ChainBadgeGroup chainIds={supportedChains} maxDisplay={3} size="sm" />
            </div>
          )}

          <WishlistButton appId={app.app_id} size="sm" />
        </div>

        {/* Description */}
        {description && (
          <p className="text-base text-muted-foreground leading-relaxed m-0 line-clamp-2">
            {description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-3">
          <Badge
            variant="secondary"
            className="px-2.5 py-0.5 font-bold uppercase text-[10px] tracking-wider bg-erobo-purple/10 text-erobo-purple-dark shadow-sm border border-erobo-purple/30"
          >
            {app.category}
          </Badge>
        </div>


        {/* Quick Stats Row */}
        {stats && (
          <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-white/30 dark:border-white/10">
            {stats.total_users != null && stats.total_users > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-erobo-ink-soft/70 dark:text-gray-400">
                <Users size={14} className="text-erobo-purple" />
                <span className="font-semibold">{stats.total_users.toLocaleString(locale)}</span>
                <span className="text-xs opacity-70">{t("detail.users")}</span>
              </div>
            )}
            {stats.total_transactions != null && stats.total_transactions > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-erobo-ink-soft/70 dark:text-gray-400">
                <Activity size={14} className="text-erobo-pink" />
                <span className="font-semibold">{stats.total_transactions.toLocaleString(locale)}</span>
                <span className="text-xs opacity-70">{t("detail.txs")}</span>
              </div>
            )}
            {stats.view_count != null && stats.view_count > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-erobo-ink-soft/70 dark:text-gray-400">
                <Eye size={14} className="text-erobo-mint" />
                <span className="font-semibold">{stats.view_count.toLocaleString(locale)}</span>
                <span className="text-xs opacity-70">{t("detail.views")}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </header >
  );
}
