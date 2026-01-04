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
  gaming: "bg-purple-100 text-purple-800",
  defi: "bg-blue-100 text-blue-800",
  social: "bg-pink-100 text-pink-800",
  governance: "bg-emerald-100 text-emerald-800",
  utility: "bg-gray-100 text-gray-800",
  nft: "bg-teal-100 text-teal-800",
};

const sourceColors = {
  builtin: "",
  community: "bg-teal-100 text-teal-800 border-teal-300",
  verified: "bg-emerald-100 text-emerald-800 border-emerald-300",
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
    <Link href={`/miniapps/${app.app_id}`} className="relative block">
      <Card className="group cursor-pointer transition-all duration-300 ease-out hover:shadow-xl hover:-translate-y-1 hover:z-50 overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-md relative">
        {app.cardData ? (
          <div className="w-full h-48 relative">
            <CardRenderer data={app.cardData} className="h-full" />
            <CollectionStar appId={app.app_id} className="absolute top-2 right-2 z-10" />
          </div>
        ) : (
          <div className="w-full h-48 relative">
            <DynamicBanner
              category={app.category}
              icon={app.icon}
              appId={app.app_id}
              appName={appName}
              highlights={app.highlights}
            />
            <CollectionStar appId={app.app_id} className="absolute top-2 right-2 z-10" />
          </div>
        )}
        <CardContent className="p-5 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-3 mb-2">
            <MiniAppLogo appId={app.app_id} category={app.category} size="md" iconUrl={app.icon} />
            <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate flex-1">{appName}</h3>
            <Badge className={categoryColors[app.category]} variant="secondary">
              {categoryLabel}
            </Badge>
            {showSourceBadge && (
              <Badge className={sourceColors[app.source!]} variant="outline">
                {app.source === "community" ? "🌐 Community" : "✓ Verified"}
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 group-hover:line-clamp-none leading-relaxed mb-3 transition-all duration-300">
            {appDesc}
          </p>

          {/* Stats Section */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <span>👥</span>
              <span>{formatNumber(app.stats?.users)}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <span>📊</span>
              <span>{formatNumber(app.stats?.transactions)} txs</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <span>💰</span>
              <span>{app.stats?.volume || "0 GAS"}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
