import React from "react";
import { MiniAppInfo, MiniAppStats } from "./types";
import { useI18n, useTranslation } from "@/lib/i18n/react";
import { MiniAppLogo } from "./features/miniapp/MiniAppLogo";
import { Badge } from "@/components/ui/badge";
import { ChainBadge } from "@/components/ui/ChainBadge";
import { WishlistButton } from "./features/wishlist";
import { Users, Activity, Eye } from "lucide-react";
import type { ChainId } from "@/lib/chains/types";

function isIconUrl(icon: string): boolean {
  if (!icon) return false;
  return icon.startsWith("/") || icon.startsWith("http") || icon.endsWith(".svg") || icon.endsWith(".png");
}

type Props = {
  app: MiniAppInfo;
  stats?: MiniAppStats;
  onClickBack?: () => void;
};

export function AppDetailHeader({ app, stats }: Props) {
  const { locale } = useI18n();
  const { t } = useTranslation("host");
  const appName = locale === "zh" && app.name_zh ? app.name_zh : app.name;
  const supportedChains = (app.supportedChains || []) as ChainId[];

  let statusBadge = stats?.last_activity_at ? "Active" : "Inactive";

  if (app.status === "active") {
    statusBadge = "Online";
  } else if (app.status === "disabled") {
    statusBadge = "Maintenance";
  } else if (app.status === "pending") {
    statusBadge = "Pending";
  }

  return (
    <header className="pt-28 pb-10 px-8 relative z-10 overflow-hidden bg-white/70 dark:bg-[#0b0c16]/90 backdrop-blur-xl border-b border-white/60 dark:border-white/10 transition-all duration-300">
      {/* E-Robo Background Glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-[var(--erobo-purple)]/20 to-transparent rounded-full blur-[100px] pointer-events-none -mr-32 -mt-32 opacity-70" />

      <div className="flex items-center gap-8 relative max-w-7xl mx-auto">
        <div className="w-28 h-28 rounded-3xl flex items-center justify-center flex-shrink-0 group hover:scale-105 transition-transform duration-300 relative z-20 overflow-hidden">
          {isIconUrl(app.icon) ? (
            <MiniAppLogo
              appId={app.app_id}
              category={app.category}
              size="lg"
              iconUrl={app.icon}
              className="w-full h-full rounded-3xl"
            />
          ) : (
            <div className="w-full h-full bg-white/80 dark:bg-white/5 border border-white/60 dark:border-white/10 rounded-3xl flex items-center justify-center shadow-2xl backdrop-blur-xl">
              <span className="text-6xl transition-transform group-hover:scale-110 duration-300 inline-block drop-shadow-sm">
                {app.icon}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 relative z-20">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Badge
              variant="secondary"
              className="px-3 py-1 font-bold uppercase text-[10px] tracking-wider bg-erobo-purple/10 text-erobo-purple-dark shadow-sm border border-erobo-purple/30"
            >
              {app.category}
            </Badge>
            <div
              className={`px-3 py-1 rounded-full font-bold uppercase text-[10px] tracking-wider flex items-center gap-2 border shadow-sm backdrop-blur-sm ${
                statusBadge === "Online"
                  ? "bg-erobo-purple/10 text-erobo-purple border-erobo-purple/30"
                  : statusBadge === "Maintenance"
                    ? "bg-erobo-peach/40 text-erobo-ink border-white/60"
                    : "bg-white/70 dark:bg-white/5 text-erobo-ink-soft/70 dark:text-gray-400 border-white/60 dark:border-white/10"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  statusBadge === "Online"
                    ? "bg-erobo-purple animate-pulse shadow-[0_0_8px_currentColor]"
                    : "bg-current opacity-50"
                }`}
              />
              {statusBadge}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <h1 className="text-4xl md:text-5xl font-bold text-erobo-ink dark:text-white leading-tight tracking-tight drop-shadow-sm break-words bg-clip-text text-transparent bg-gradient-to-r from-erobo-ink via-erobo-ink-soft to-erobo-ink dark:from-white dark:via-gray-200 dark:to-white">
              {appName}
            </h1>
            <WishlistButton appId={app.app_id} size="lg" />
          </div>

          {/* Quick Stats & Chain Badges - Steam-style */}
          <div className="flex flex-wrap items-center gap-6 mt-4">
            {/* Quick Stats */}
            {stats && (
              <div className="flex items-center gap-4">
                {stats.total_users != null && stats.total_users > 0 && (
                  <div className="flex items-center gap-1.5 text-sm text-erobo-ink-soft/70 dark:text-gray-400">
                    <Users size={14} className="text-erobo-purple" />
                    <span className="font-medium">{stats.total_users.toLocaleString()}</span>
                    <span className="text-xs">{t("detail.users") || "users"}</span>
                  </div>
                )}
                {stats.total_transactions != null && stats.total_transactions > 0 && (
                  <div className="flex items-center gap-1.5 text-sm text-erobo-ink-soft/70 dark:text-gray-400">
                    <Activity size={14} className="text-erobo-pink" />
                    <span className="font-medium">{stats.total_transactions.toLocaleString()}</span>
                    <span className="text-xs">{t("detail.txs") || "txs"}</span>
                  </div>
                )}
                {stats.view_count != null && stats.view_count > 0 && (
                  <div className="flex items-center gap-1.5 text-sm text-erobo-ink-soft/70 dark:text-gray-400">
                    <Eye size={14} className="text-erobo-mint" />
                    <span className="font-medium">{stats.view_count.toLocaleString()}</span>
                    <span className="text-xs">{t("detail.views") || "views"}</span>
                  </div>
                )}
              </div>
            )}

            {/* Supported Chains */}
            {supportedChains.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/50 dark:bg-white/5 rounded-full border border-white/60 dark:border-white/10">
                <span className="text-xs text-erobo-ink-soft/60 dark:text-gray-500 font-medium">
                  {t("detail.chains") || "Chains"}:
                </span>
                <div className="flex items-center gap-1">
                  {supportedChains.slice(0, 4).map((chainId) => (
                    <ChainBadge key={chainId} chainId={chainId} size="sm" />
                  ))}
                  {supportedChains.length > 4 && (
                    <span className="text-xs text-erobo-ink-soft/60 dark:text-gray-500">
                      +{supportedChains.length - 4}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
