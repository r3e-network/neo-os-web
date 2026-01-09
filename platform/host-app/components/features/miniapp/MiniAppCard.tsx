"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CardRenderer } from "./CardRenderer";
import { DynamicBanner, type HighlightData } from "./DynamicBanner";
import { MiniAppLogo } from "./MiniAppLogo";
import { CollectionStar } from "./CollectionStar";
import { useTranslation } from "@/lib/i18n/react";
import type { AnyCardData } from "@/types/card-display";
import { Users, Activity, Eye } from "lucide-react";

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
  stats?: {
    users?: number;
    transactions?: number;
    volume?: string;
    views?: number;
  };
  cardData?: AnyCardData;
  highlights?: HighlightData[];
}

const categoryColors = {
  gaming: "bg-brutal-yellow text-black border-black dark:border-white",
  defi: "bg-neo text-black border-black dark:border-white",
  social: "bg-brutal-pink text-black border-black dark:border-white",
  governance: "bg-brutal-blue text-white border-black dark:border-white",
  utility: "bg-electric-purple text-white border-black dark:border-white",
  nft: "bg-brutal-lime text-black border-black dark:border-white",
};

const sourceColors = {
  builtin: "",
  community: "bg-brutal-orange text-black border-black dark:border-white",
  verified: "bg-neo text-black border-black dark:border-white",
};

// Format number with K/M suffix
function formatNumber(num?: number): string {
  if (num === undefined || num === null) return "0";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

export function MiniAppCard({ app }: { app: MiniAppInfo }) {
  const { t, locale } = useTranslation("host");
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);
  const showSourceBadge = app.source && app.source !== "builtin";

  // Get translated category name
  const categoryLabel = t(`categories.${app.category}`) || app.category;

  // Self-contained i18n: use MiniApp's own translations based on locale
  const appName = locale === "zh" && app.name_zh ? app.name_zh : app.name;
  const appDesc = locale === "zh" && app.description_zh ? app.description_zh : app.description;

  // Handle ripple effect on click
  const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    setRipples((prev) => [...prev, { x, y, id }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 800);
  }, []);

  return (
    <Link
      href={{
        pathname: `/miniapps/${app.app_id}`,
        query: typeof window !== "undefined" ? window.location.search.substring(1) : "",
      }}
      className="block h-full"
      onClick={handleClick}
    >
      <Card className="h-full group relative flex flex-col overflow-hidden rounded-[20px] bg-white dark:bg-[#080808]/80 backdrop-blur-xl border border-gray-200 dark:border-white/5 shadow-lg dark:shadow-2xl transition-all duration-300 hover:transform hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(159,157,243,0.3)] hover:border-[rgba(159,157,243,0.4)]">
        {/* Card Header / Image Area */}
        {app.cardData ? (
          <div className="w-full h-52 relative overflow-hidden border-b border-gray-100 dark:border-gray-800">
            <div className="absolute inset-0 bg-gray-50 dark:bg-gray-800/50 animate-pulse-slow" />
            <CardRenderer data={app.cardData} className="h-full relative z-10" />
            <div className="absolute inset-0 bg-gradient-to-t from-white/60 dark:from-black/80 to-transparent z-10 pointer-events-none" />
            <CollectionStar
              appId={app.app_id}
              className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-[0_0_10px_rgba(255,223,89,0.5)]"
            />
          </div>
        ) : (
          <div className="w-full h-52 relative overflow-hidden border-b border-gray-100 dark:border-gray-800">
            <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-105">
              <DynamicBanner
                category={app.category}
                icon={app.icon}
                appId={app.app_id}
                appName={appName}
                highlights={app.highlights}
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-white/60 dark:from-black/80 to-transparent z-10 pointer-events-none" />
            <CollectionStar
              appId={app.app_id}
              className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-[0_0_10px_rgba(255,223,89,0.5)]"
            />
          </div>
        )}

        {/* Card Content */}
        <CardContent className="p-5 flex flex-col flex-1 relative z-10">
          <div className="flex items-start gap-4 mb-3">
            <MiniAppLogo appId={app.app_id} category={app.category} size="md" iconUrl={app.icon} />
            <div className="flex-1 min-w-0 pt-1">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate leading-tight mb-2 group-hover:text-neo transition-colors">
                {appName}
              </h3>
              <div className="flex flex-wrap gap-2">
                <Badge
                  className="text-[10px] font-medium uppercase px-2.5 py-0.5 rounded-full border border-gray-300 dark:border-white/10 bg-gray-200 dark:bg-white/5 backdrop-blur-md text-gray-700 dark:text-gray-300"
                  variant="secondary"
                >
                  {categoryLabel}
                </Badge>
                {showSourceBadge && (
                  <Badge
                    className={`text-[10px] font-medium uppercase px-2.5 py-0.5 rounded-full border border-gray-200 dark:border-white/10 backdrop-blur-md ${
                      app.source === "verified"
                        ? "bg-neo/10 text-neo border-neo/20"
                        : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                    }`}
                    variant="secondary"
                  >
                    {app.source === "community" ? "Community" : "Verified"}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed mb-4 flex-1 font-light">
            {appDesc}
          </p>

          {/* Stats Section */}
          <div className="grid grid-cols-3 gap-2 py-3 border-t border-gray-100 dark:border-gray-800 mt-auto bg-gray-50/50 dark:bg-gray-800/30 -mx-5 -mb-5 px-5">
            <div className="flex flex-col items-center justify-center gap-0.5 text-center" title="Active Users">
              <Users size={14} className="text-neo mb-0.5" strokeWidth={2.5} />
              <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                {formatNumber(app.stats?.users)}
              </span>
              <span className="text-[9px] text-gray-500 uppercase tracking-wider font-medium">Users</span>
            </div>
            <div className="flex flex-col items-center justify-center gap-0.5 text-center" title="Transactions">
              <Activity size={14} className="text-electric-purple mb-0.5" strokeWidth={2.5} />
              <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                {formatNumber(app.stats?.transactions)}
              </span>
              <span className="text-[9px] text-gray-500 uppercase tracking-wider font-medium">TXs</span>
            </div>
            <div className="flex flex-col items-center justify-center gap-0.5 text-center" title="Views">
              <Eye size={14} className="text-blue-400 mb-0.5" strokeWidth={2.5} />
              <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                {formatNumber(app.stats?.views)}
              </span>
              <span className="text-[9px] text-gray-500 uppercase tracking-wider font-medium">Views</span>
            </div>
          </div>
        </CardContent>

        {/* Ripple Effect */}
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            className="absolute rounded-full bg-erobo-purple/30 animate-ripple-expand pointer-events-none"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: 20,
              height: 20,
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}
      </Card>
    </Link>
  );
}
