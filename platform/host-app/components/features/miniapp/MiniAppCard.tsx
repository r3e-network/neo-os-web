"use client";

import { memo } from "react";
import Link from "next/link";
import { Users, BarChart3, Coins as CoinsIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CardRenderer } from "./CardRenderer";
import { DynamicBanner } from "./DynamicBanner";
import { MiniAppLogo } from "./MiniAppLogo";
import type { AnyCardData } from "@/types/card-display";

export interface MiniAppInfo {
  app_id: string;
  name: string;
  description: string;
  icon: string;
  category: "gaming" | "defi" | "social" | "governance" | "utility" | "nft" | "data" | "other";
  source?: "builtin" | "community" | "verified";
  stats?: {
    users?: number;
    transactions?: number;
    volume?: string;
  };
  cardData?: AnyCardData;
}

const categoryColors = {
  gaming: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300",
  defi: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300",
  social: "bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-300",
  governance: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300",
  utility: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  nft: "bg-teal-100 text-teal-800 dark:bg-teal-900/20 dark:text-teal-300",
  data: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-300",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

const sourceColors = {
  builtin: "",
  community: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-700",
  verified:
    "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-700",
};

// Format number with K/M suffix
function formatNumber(num?: number): string {
  if (num === undefined || num === null) return "0";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

export const MiniAppCard = memo(function MiniAppCard({ app }: { app: MiniAppInfo }) {
  const showSourceBadge = app.source && app.source !== "builtin";

  return (
    <Link href={`/miniapps/${app.app_id}`} aria-label={`View ${app.name}`} className="relative block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50">
      <Card className="group cursor-pointer transition-all duration-300 ease-out hover:shadow-xl hover:-translate-y-1 hover:z-10 overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-md relative">
        {app.cardData ? (
          <div className="w-full h-48">
            <CardRenderer data={app.cardData} className="h-full" />
          </div>
        ) : (
          <div className="w-full h-48">
            <DynamicBanner category={app.category} icon={app.icon} appId={app.app_id} />
          </div>
        )}
        <CardContent className="p-5 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-3 mb-2">
            <MiniAppLogo appId={app.app_id} category={app.category} size="md" />
            <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate flex-1 min-w-0">{app.name}</h3>
            <Badge className={categoryColors[app.category]} variant="secondary">
              {app.category}
            </Badge>
            {showSourceBadge && (
              <Badge className={sourceColors[app.source!]} variant="outline">
                {app.source === "community" ? "🌐 Community" : "✓ Verified"}
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 group-hover:line-clamp-none leading-relaxed mb-3 transition-all duration-300">
            {app.description}
          </p>

          {/* Stats Section */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <Users size={12} aria-hidden="true" />
              <span>{formatNumber(app.stats?.users)} users</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <BarChart3 size={12} aria-hidden="true" />
              <span>{formatNumber(app.stats?.transactions)} txs</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <CoinsIcon size={12} aria-hidden="true" />
              <span>{app.stats?.volume || "0 GAS"}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
});
