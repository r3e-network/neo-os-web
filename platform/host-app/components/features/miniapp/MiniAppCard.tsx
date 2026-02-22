"use client";

import { memo, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { buildMiniAppBannerSources } from "@/lib/miniapp-media";
import { MiniAppLogo } from "./MiniAppLogo";
import { Users, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

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
  gaming: "bg-purple-100 text-purple-800 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/20",
  defi: "bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20",
  social: "bg-pink-100 text-pink-800 dark:bg-pink-500/10 dark:text-pink-300 dark:border-pink-500/20",
  governance: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
  utility: "bg-gray-100 text-gray-800 dark:bg-gray-500/10 dark:text-gray-300 dark:border-gray-500/20",
  nft: "bg-teal-100 text-teal-800 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/20",
  data: "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/20",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-500/10 dark:text-gray-300 dark:border-gray-500/20",
};

const sourceColors = {
  builtin: "",
  community: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700/50",
  verified:
    "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/50",
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
      className="relative block rounded-3xl outline-none"
    >
      <Card className="group overflow-hidden glass-card rounded-3xl border border-gray-200/50 dark:border-white/5 bg-white/60 dark:bg-[#0C0D14]/70 shadow-lg hover:shadow-[0_10px_40px_rgba(0,229,153,0.15)] transition-all duration-500 hover:-translate-y-2 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/0 dark:from-white/5 dark:to-transparent pointer-events-none z-10 rounded-3xl" />
        <div className="h-48 w-full bg-gray-100 dark:bg-[#12131C] relative overflow-hidden">
          {bannerSource ? (
            <img
              src={bannerSource}
              alt={`${app.name} banner`}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out"
              loading="lazy"
              onError={() => {
                setBannerIndex((prev) => (prev + 1 < bannerSources.length ? prev + 1 : bannerSources.length));
              }}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 text-sm font-semibold text-gray-500 dark:text-gray-400 group-hover:scale-110 transition-transform duration-700">
              {app.name}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10" />
        </div>

        <CardContent className="p-6 pt-5 relative bg-transparent z-20">
          <div className="absolute -top-10 left-6 z-30 p-1.5 bg-white/80 dark:bg-[#12131C]/80 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/50 dark:border-white/10 group-hover:-translate-y-2 transition-transform duration-500">
            <MiniAppLogo appId={app.app_id} category={app.category} entryUrl={app.entry_url} logoUrl={app.logo_url} size="lg" className="rounded-xl" />
          </div>

          <div className="flex justify-end gap-2 mb-4 h-6">
            <Badge className={cn(categoryColors[app.category], "border border-transparent capitalize px-3 py-1 text-xs font-bold font-mono tracking-tight")} variant="secondary">
              {app.category}
            </Badge>
            {showSourceBadge && (
              <Badge className={cn(sourceColors[app.source!], "px-2 tracking-tight text-xs font-semibold backdrop-blur-md")} variant="outline">
                {app.source === "community" ? "🌐 Community" : "✓ Verified"}
              </Badge>
            )}
          </div>

          <h3 className="min-w-0 flex-1 truncate text-xl font-black text-gray-900 dark:text-white mb-2 group-hover:text-neo transition-colors duration-300" title={app.name}>
            {app.name}
          </h3>

          <p className="line-clamp-2 text-sm font-medium leading-relaxed text-gray-600 dark:text-gray-400 mb-5 min-h-[40px]" title={app.description}>
            {app.description}
          </p>

          <div className="border-t border-gray-200/50 dark:border-white/5 pt-4 mt-auto flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Users size={14} className="text-gray-400 dark:text-gray-500" />
                <span>{app.stats?.users?.toLocaleString() || "0"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Activity size={14} className="text-gray-400 dark:text-gray-500" />
                <span>{app.stats?.transactions?.toLocaleString() || "0"}</span>
              </div>
            </div>

            <div className="text-neo flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0 duration-300 transform">
              Launch <span aria-hidden="true">&rarr;</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
});
