"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CardRenderer } from "./CardRenderer";
import { DynamicBanner, type HighlightData } from "./DynamicBanner";
import { MiniAppLogo } from "./MiniAppLogo";
import { CollectionStar } from "./CollectionStar";
import { useTranslation } from "@/lib/i18n/react";
import { formatNumber } from "@/lib/utils";
import type { AnyCardData } from "@/types/card-display";
import { Users, Activity, Eye, Star } from "lucide-react";
import { WaterRipple } from "@/components/ui/WaterRipple";
import { ChainBadgeGroup } from "@/components/ui/ChainBadgeGroup";
import { getLocalizedField } from "@neo/shared/i18n";
import type { ChainId } from "@/lib/chains/types";

export interface MiniAppInfo {
  app_id: string;
  name: string;
  // Self-contained i18n: each MiniApp provides its own translations
  name_zh?: string;
  description: string;
  description_zh?: string;
  icon: string;
  category: "gaming" | "defi" | "social" | "governance" | "utility" | "nft";
  source?: "builtin" | "community" | "verified";
  /** Supported chains for multi-chain apps */
  supportedChains?: ChainId[];
  stats?: {
    users?: number;
    transactions?: number;
    volume?: string;
    views?: number;
    rating?: number;
    reviews?: number;
  };
  cardData?: AnyCardData;
  highlights?: HighlightData[];
  banner?: string;
  [key: string]: any;
}

export function MiniAppCard({ app }: { app: MiniAppInfo }) {
  const { t, locale } = useTranslation("host");
  const showSourceBadge = app.source && app.source !== "builtin";

  // Get translated category name
  const categoryLabel = t(`categories.${app.category}`);

  // Self-contained i18n: use MiniApp's own translations based on locale
  const appName = getLocalizedField(app, "name", locale);
  const appDesc = getLocalizedField(app, "description", locale);

  return (
    <WaterRipple className="h-full w-full" rippleColor="rgba(159, 157, 243, 0.35)">
      <Link
        href={{
          pathname: `/miniapps/${app.app_id}`,
          query: typeof window !== "undefined" ? window.location.search.substring(1) : "",
        }}
        className="block h-full"
      >
        <Card className="h-full group relative flex flex-col overflow-hidden rounded-[28px] transition-all duration-300 hover:transform hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(159,157,243,0.2)] group-hover:border-erobo-purple/40 bg-white/10 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-white/5">
          {/* Card Header / Image Area */}
          {app.cardData ? (
            <div className="w-full h-52 relative overflow-hidden border-b border-white/60 dark:border-white/10">
              <div className="absolute inset-0 bg-gradient-to-br from-erobo-purple/10 via-white/60 to-erobo-peach/30 dark:from-white/5 dark:via-transparent dark:to-white/10 animate-pulse-slow" />
              <CardRenderer data={app.cardData} className="h-full relative z-10" />
              <div className="absolute inset-0 bg-gradient-to-t from-white/70 dark:from-black/80 to-transparent z-10 pointer-events-none" />
              <CollectionStar
                appId={app.app_id}
                className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-[0_0_10px_rgba(255,223,89,0.5)]"
              />
              {/* Chain badges in bottom-left corner */}
              {app.supportedChains && app.supportedChains.length > 0 && (
                <ChainBadgeGroup chainIds={app.supportedChains} className="absolute bottom-4 left-4 z-20" />
              )}
            </div>
          ) : (
            <div className="w-full h-52 relative overflow-hidden border-b border-white/60 dark:border-white/10">
              <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-105">
                {app.banner ? (
                  <img src={app.banner} alt={appName} className="w-full h-full object-cover" />
                ) : (
                  <DynamicBanner
                    category={app.category}
                    icon={app.icon}
                    appId={app.app_id}
                    appName={appName}
                    highlights={app.highlights}
                  />
                )}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-white/70 dark:from-black/80 to-transparent z-10 pointer-events-none" />
              <CollectionStar
                appId={app.app_id}
                className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-[0_0_10px_rgba(255,223,89,0.5)]"
              />
              {/* Chain badges in bottom-left corner */}
              {app.supportedChains && app.supportedChains.length > 0 && (
                <ChainBadgeGroup chainIds={app.supportedChains} className="absolute bottom-4 left-4 z-20" />
              )}
            </div>
          )}

          {/* Card Content */}
          <CardContent className="p-5 flex flex-col flex-1 relative z-10">
            <div className="flex items-start gap-4 mb-3">
              <MiniAppLogo appId={app.app_id} category={app.category} size="md" iconUrl={app.icon} />
              <div className="flex-1 min-w-0 pt-0.5">
                <h3 className="font-bold text-lg text-erobo-ink dark:text-white truncate leading-tight mb-2 group-hover:text-erobo-purple transition-colors tracking-tight">
                  {appName}
                </h3>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge
                    className="text-[10px] font-medium uppercase px-2 py-0.5 rounded-full border border-erobo-purple/30 bg-erobo-purple/5 text-erobo-purple-dark dark:text-erobo-purple shadow-[0_0_10px_rgba(159,157,243,0.1)]"
                    variant="secondary"
                  >
                    {categoryLabel}
                  </Badge>
                  {showSourceBadge && (
                    <Badge
                      className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded-full border backdrop-blur-md ${app.source === "verified"
                        ? "bg-neo/10 text-neo border-neo/20"
                        : "bg-erobo-peach/40 text-erobo-ink border-erobo-peach/60"
                        }`}
                      variant="secondary"
                    >
                      {app.source === "community" ? "Community" : "Verified"}
                    </Badge>
                  )}
                  {/* Steam-style Rating Display */}
                  {app.stats?.rating && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-yellow-400/10 border border-yellow-400/20">
                      <Star size={9} className="text-yellow-400 fill-yellow-400" />
                      <span suppressHydrationWarning className="text-[10px] font-bold text-yellow-600 dark:text-yellow-400 leading-none">
                        {app.stats.rating.toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <p className="text-sm text-erobo-ink-soft/80 dark:text-gray-400 line-clamp-2 leading-relaxed mb-6 flex-1 font-normal">
              {appDesc}
            </p>

            {/* Stats Section - Clean & Minimal */}
            <div className="flex items-center justify-between py-3 border-t border-erobo-purple/10 dark:border-white/5 mt-auto bg-transparent px-1">
              <div className="flex items-center gap-1.5" title="Active Users">
                <div className="p-1 rounded-full bg-erobo-purple/10">
                  <Users size={12} className="text-erobo-purple" strokeWidth={2.5} />
                </div>
                <div className="flex flex-col">
                  <span suppressHydrationWarning className="text-xs font-bold text-erobo-ink dark:text-gray-200 leading-none">
                    {formatNumber(app.stats?.users)}
                  </span>
                  <span className="text-[9px] text-erobo-ink-soft/60 uppercase font-medium leading-none mt-0.5">Users</span>
                </div>
              </div>

              <div className="w-px h-6 bg-gradient-to-b from-transparent via-erobo-purple/10 to-transparent mx-2" />

              <div className="flex items-center gap-1.5" title="Transactions">
                <div className="p-1 rounded-full bg-erobo-pink/10">
                  <Activity size={12} className="text-erobo-pink" strokeWidth={2.5} />
                </div>
                <div className="flex flex-col">
                  <span suppressHydrationWarning className="text-xs font-bold text-erobo-ink dark:text-gray-200 leading-none">
                    {formatNumber(app.stats?.transactions)}
                  </span>
                  <span className="text-[9px] text-erobo-ink-soft/60 uppercase font-medium leading-none mt-0.5">TXs</span>
                </div>
              </div>

              <div className="w-px h-6 bg-gradient-to-b from-transparent via-erobo-purple/10 to-transparent mx-2" />

              <div className="flex items-center gap-1.5" title="Views">
                <div className="p-1 rounded-full bg-erobo-sky/10">
                  <Eye size={12} className="text-erobo-sky" strokeWidth={2.5} />
                </div>
                <div className="flex flex-col">
                  <span suppressHydrationWarning className="text-xs font-bold text-erobo-ink dark:text-gray-200 leading-none">
                    {formatNumber(app.stats?.views)}
                  </span>
                  <span className="text-[9px] text-erobo-ink-soft/60 uppercase font-medium leading-none mt-0.5">Views</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </WaterRipple>
  );
}
