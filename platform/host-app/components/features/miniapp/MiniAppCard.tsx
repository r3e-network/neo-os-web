import { memo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MiniAppLogo } from "./MiniAppLogo";
import { CollectionStar } from "./CollectionStar";
import { CardStats, RatingBadge } from "./CardStats";
import { useTranslation } from "@/lib/i18n/react";
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
  entry_url?: string;
  category: "gaming" | "defi" | "social" | "governance" | "utility" | "nft";
  source?: "builtin" | "community" | "verified";
  created_at?: string;
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
  banner?: string;
  [key: string]: unknown;
}

export const MiniAppCard = memo(function MiniAppCard({ app }: { app: MiniAppInfo }) {
  const { t, locale } = useTranslation("host");
  const showSourceBadge = app.source && app.source !== "builtin";
  const rippleId = app.app_id || app.entry_url || app.name;

  // Get translated category name
  const categoryLabel = t(`categories.${app.category}`);

  // Self-contained i18n: use MiniApp's own translations based on locale
  const appName = getLocalizedField(app, "name", locale);
  const appDesc = getLocalizedField(app, "description", locale);

  return (
    <WaterRipple className="h-full w-full" rippleColor="rgba(159, 157, 243, 0.35)" idSuffix={rippleId}>
      <Link
        href={{
          pathname: `/miniapps/${app.app_id}`,
          query: typeof window !== "undefined" ? window.location.search.substring(1) : "",
        }}
        className="block h-full"
      >
        <Card className="h-full group relative flex flex-col overflow-hidden rounded-[28px] transition-all duration-300 hover:transform hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(159,157,243,0.2)] group-hover:border-erobo-purple/40 bg-white/10 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-white/5">
          {/* Card Header / Image Area */}
          {/* Card Header / Image Area */}
          <div className="w-full h-52 relative overflow-hidden border-b border-white/60 dark:border-white/10">
            <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-105">
              <Image
                src={app.banner || "/static/placeholder-banner.jpg"}
                alt={appName}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
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
                      className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded-full border backdrop-blur-md ${
                        app.source === "verified"
                          ? "bg-neo/10 text-neo border-neo/20"
                          : "bg-erobo-peach/40 text-erobo-ink border-erobo-peach/60"
                      }`}
                      variant="secondary"
                    >
                      {app.source === "community" ? "Community" : "Verified"}
                    </Badge>
                  )}
                  {/* Steam-style Rating Display */}
                  {app.stats?.rating && <RatingBadge rating={app.stats.rating} />}
                </div>
              </div>
            </div>

            <p className="text-sm text-erobo-ink-soft/80 dark:text-slate-400 line-clamp-2 leading-relaxed mb-6 flex-1 font-normal">
              {appDesc}
            </p>

            {/* Stats Section */}
            <CardStats users={app.stats?.users} transactions={app.stats?.transactions} views={app.stats?.views} />
          </CardContent>
        </Card>
      </Link>
    </WaterRipple>
  );
});
