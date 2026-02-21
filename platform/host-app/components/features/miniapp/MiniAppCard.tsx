"use client";

import { memo, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { buildMiniAppBannerSources } from "@/lib/miniapp-media";
import { MiniAppLogo } from "./MiniAppLogo";

export interface MiniAppInfo {
  app_id: string;
  name: string;
  description: string;
  icon: string;
  entry_url?: string;
  logo_url?: string | null;
  banner_url?: string | null;
  category: "gaming" | "defi" | "social" | "governance" | "utility" | "nft" | "data" | "other";
  source?: "builtin" | "community" | "verified";
  stats?: {
    users?: number;
    transactions?: number;
    volume?: string;
  };
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

export const MiniAppCard = memo(function MiniAppCard({ app }: { app: MiniAppInfo }) {
  const showSourceBadge = app.source && app.source !== "builtin";
  const bannerSources = useMemo(
    () =>
      buildMiniAppBannerSources({
        appID: app.app_id,
        entryURL: app.entry_url,
        bannerURL: app.banner_url,
      }),
    [app.app_id, app.banner_url, app.entry_url],
  );
  const [bannerIndex, setBannerIndex] = useState(0);

  useEffect(() => {
    setBannerIndex(0);
  }, [bannerSources]);

  const bannerSource = bannerSources[bannerIndex];

  return (
    <Link
      href={`/miniapps/${app.app_id}`}
      aria-label={`View ${app.name}`}
      className="relative block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
    >
      <Card className="group overflow-hidden border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
        <div className="h-44 w-full bg-gray-100 dark:bg-gray-800">
          {bannerSource ? (
            <img
              src={bannerSource}
              alt={`${app.name} banner`}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={() => {
                setBannerIndex((prev) => (prev + 1 < bannerSources.length ? prev + 1 : bannerSources.length));
              }}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center px-4 text-center text-sm font-semibold text-gray-600 dark:text-gray-300">
              {app.name}
            </div>
          )}
        </div>
        <CardContent className="bg-white p-4 dark:bg-gray-900">
          <div className="mb-2 flex items-center gap-3">
            <MiniAppLogo appId={app.app_id} category={app.category} entryUrl={app.entry_url} logoUrl={app.logo_url} size="md" />
            <h3 className="min-w-0 flex-1 truncate text-lg font-bold text-gray-900 dark:text-white" title={app.name}>
              {app.name}
            </h3>
            <Badge className={categoryColors[app.category]} variant="secondary">
              {app.category}
            </Badge>
            {showSourceBadge && (
              <Badge className={sourceColors[app.source!]} variant="outline">
                {app.source === "community" ? "🌐 Community" : "✓ Verified"}
              </Badge>
            )}
          </div>
          <p className="line-clamp-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400" title={app.description}>
            {app.description}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
});
