"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CardRenderer } from "./CardRenderer";
import { DynamicBanner, type HighlightData } from "./DynamicBanner";
import { MiniAppLogo } from "./MiniAppLogo";
import { CollectionStar } from "./CollectionStar";
import { useTranslation } from "@/lib/i18n/react";
import type { AnyCardData } from "@/types/card-display";
import { Users, Activity, Coins } from "lucide-react";

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
  };
  cardData?: AnyCardData;
  highlights?: HighlightData[];
}

const categoryColors = {
  gaming: "bg-brutal-yellow text-black border-black",
  defi: "bg-neo text-black border-black",
  social: "bg-brutal-pink text-black border-black",
  governance: "bg-brutal-blue text-white border-black",
  utility: "bg-electric-purple text-white border-black",
  nft: "bg-brutal-lime text-black border-black",
};

const sourceColors = {
  builtin: "",
  community: "bg-brutal-orange text-black border-black",
  verified: "bg-neo text-black border-black",
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
  const showSourceBadge = app.source && app.source !== "builtin";

  // Get translated category name
  const categoryLabel = t(`categories.${app.category}`) || app.category;

  // Self-contained i18n: use MiniApp's own translations based on locale
  const appName = locale === "zh" && app.name_zh ? app.name_zh : app.name;
  const appDesc = locale === "zh" && app.description_zh ? app.description_zh : app.description;

  return (
    <Link href={`/miniapps/${app.app_id}`} className="relative block group">
      <Card className="h-full overflow-hidden bg-white dark:bg-black border-4 border-black dark:border-white shadow-brutal-md transition-all duration-300 hover:-translate-y-2 hover:-translate-x-2 hover:shadow-brutal-lg rounded-none z-10 hover:z-20">
        {app.cardData ? (
          <div className="w-full h-52 relative overflow-hidden border-b-4 border-black dark:border-white">
            <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800 animate-pulse-slow" />
            <CardRenderer data={app.cardData} className="h-full relative z-10" />
            <CollectionStar appId={app.app_id} className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        ) : (
          <div className="w-full h-52 relative overflow-hidden border-b-4 border-black dark:border-white">
            <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-110">
              <DynamicBanner
                category={app.category}
                icon={app.icon}
                appId={app.app_id}
                appName={appName}
                highlights={app.highlights}
              />
            </div>
            <CollectionStar appId={app.app_id} className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
        <CardContent className="p-6 bg-white dark:bg-black/40 flex flex-col h-[calc(100%-13rem)]">
          <div className="flex items-start gap-4 mb-4">
            <MiniAppLogo appId={app.app_id} category={app.category} size="md" iconUrl={app.icon} className="shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-xl text-black dark:text-white truncate leading-none mb-2 uppercase tracking-tighter italic">{appName}</h3>
              <div className="flex flex-wrap gap-2">
                <Badge className={`text-[10px] font-black uppercase border-2 px-2 py-0.5 rounded-none shadow-brutal-xs ${categoryColors[app.category]}`} variant="secondary">
                  {categoryLabel}
                </Badge>
                {showSourceBadge && (
                  <Badge className={`text-[10px] font-black uppercase border-2 px-2 py-0.5 rounded-none shadow-brutal-xs ${sourceColors[app.source!]}`} variant="secondary">
                    {app.source === "community" ? "Community" : "Verified"}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed mb-4 flex-1">
            {appDesc}
          </p>

          {/* Stats Section */}
          <div className="flex items-center justify-between pt-4 border-t-2 border-black dark:border-white mt-auto">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase text-black dark:text-white" title="Active Users">
              <Users size={16} className="text-black dark:text-white" strokeWidth={3} />
              <span>{formatNumber(app.stats?.users)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-black uppercase text-black dark:text-white" title="Transactions">
              <Activity size={16} className="text-black dark:text-white" strokeWidth={3} />
              <span>{formatNumber(app.stats?.transactions)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-black uppercase text-black dark:text-white" title="Volume">
              <Coins size={16} className="text-black dark:text-white" strokeWidth={3} />
              <span>{app.stats?.volume || "0 GAS"}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
