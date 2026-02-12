"use client";

import { memo } from "react";
import Link from "next/link";
import { Globe, Zap } from "lucide-react";
import { MiniAppLogo } from "./MiniAppLogo";
import { Badge } from "@/components/ui/badge";
import { ChainBadge } from "@/components/ui/ChainBadge";
import { useTranslation } from "@/lib/i18n/react";
import { formatNumber, formatTimeAgo } from "@/lib/utils";
import { getLocalizedField } from "@neo/shared/i18n";
import type { MiniAppInfo } from "./MiniAppCard";
import type { ChainId } from "@/lib/chains/types";

interface MiniAppListItemProps {
  app: MiniAppInfo;
}

export const MiniAppListItem = memo(function MiniAppListItem({ app }: MiniAppListItemProps) {
  const { t, locale } = useTranslation("host");
  const { t: tCommon } = useTranslation("common");
  const categoryLabel = t(`categories.${app.category}`);

  // Self-contained i18n: use MiniApp's own translations based on locale
  const appName = getLocalizedField(app, "name", locale);
  const appDesc = getLocalizedField(app, "description", locale);

  // Multi-chain support: get supported chains
  const supportedChains = (app.supportedChains || []) as ChainId[];

  return (
    <Link
      href={{
        pathname: `/miniapps/${app.app_id}`,
        query: typeof window !== "undefined" ? window.location.search.substring(1) : "",
      }}
      className="block erobo-card rounded-[24px] transition-all duration-300 hover:shadow-[0_25px_70px_rgba(159,157,243,0.2)] hover:-translate-y-1 group mb-3"
    >
      <div className="flex items-center gap-6 px-6 py-4">
        {/* Logo */}
        <MiniAppLogo appId={app.app_id} category={app.category} size="sm" iconUrl={app.icon} />

        {/* Content Grid */}
        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-6 items-center">
          {/* Main Info */}
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="font-bold text-erobo-ink dark:text-white text-lg group-hover:text-erobo-purple transition-colors">
                {appName}
              </h3>
              <Badge
                variant="secondary"
                className="text-[10px] font-medium uppercase px-2.5 py-0.5 rounded-full border border-erobo-purple/30 bg-erobo-purple/10 text-erobo-purple-dark dark:text-erobo-purple transition-colors h-5"
              >
                {categoryLabel}
              </Badge>
              {/* Multi-chain badges */}
              {supportedChains.length > 0 && (
                <div className="flex items-center gap-1">
                  {supportedChains.slice(0, 3).map((chainId) => (
                    <ChainBadge key={chainId} chainId={chainId} size="xs" />
                  ))}
                  {supportedChains.length > 3 && (
                    <span className="text-[10px] text-erobo-ink-soft/60 dark:text-slate-500">
                      +{supportedChains.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
            <p className="text-sm font-light text-erobo-ink-soft/80 dark:text-slate-400 truncate tracking-wide group-hover:text-erobo-ink dark:group-hover:text-slate-300">
              {appDesc}
            </p>
          </div>

          {/* Stats */}
          <div className="hidden sm:flex items-center gap-8 text-[11px] font-bold uppercase text-erobo-ink-soft/70 dark:text-slate-400">
            <div
              className="flex items-center gap-2 group-hover:text-erobo-purple transition-colors"
              title={t("miniapps.stats.activeUsers")}
            >
              <Globe
                size={16}
                strokeWidth={2.5}
                className="text-erobo-purple/70 group-hover:text-erobo-purple transition-colors"
              />
              <span suppressHydrationWarning>{formatNumber(app.stats?.users)}</span>
            </div>
            <div
              className="flex items-center gap-2 group-hover:text-erobo-pink transition-colors"
              title={t("miniapps.stats.transactions")}
            >
              <Zap
                size={16}
                strokeWidth={2.5}
                className="text-erobo-pink/70 group-hover:text-erobo-pink transition-colors"
              />
              <span suppressHydrationWarning>{formatNumber(app.stats?.transactions)}</span>
            </div>
            <div
              className="flex items-center gap-2 w-24 justify-end font-medium opacity-60 group-hover:opacity-100 transition-opacity"
              title={t("miniapps.stats.updated")}
            >
              <span suppressHydrationWarning>{formatTimeAgo(app.created_at ?? null, { t: tCommon })}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
});
