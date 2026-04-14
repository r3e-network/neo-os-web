"use client";

import { memo, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { MiniAppInfo } from "@/components/types";
import { buildMiniAppBannerSources } from "@/lib/miniapp-media";
import { MiniAppLogo } from "./MiniAppLogo";
import { cn } from "@/lib/utils";

const categoryColors = {
  gaming: "bg-purple-100 text-purple-800",
  defi: "bg-blue-100 text-blue-800",
  social: "bg-pink-100 text-pink-800",
  governance: "bg-emerald-100 text-emerald-800",
  utility: "bg-gray-100 text-gray-800",
  nft: "bg-teal-100 text-teal-800",
  data: "bg-cyan-100 text-cyan-800",
  other: "bg-gray-100 text-gray-800",
};

const sourceColors = {
  miniapp: "",
  community: "bg-teal-100 text-teal-800 border-teal-300",
  verified: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

const statusColors = {
  beta: "bg-sky-100 text-sky-800 border-sky-300",
};

export const MiniAppCard = memo(function MiniAppCard({ app }: { app: MiniAppInfo }) {
  const showSourceBadge = app.source && app.source !== "miniapp";
  const bannerSources = useMemo(
    () =>
      buildMiniAppBannerSources({
        appID: app.app_id,
        entryURL: app.entry_url,
        bannerURL: app.banner_url,
        manifest: app.manifest || null,
      }),
    [app.app_id, app.banner_url, app.entry_url, app.manifest],
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
      <Card className="group overflow-hidden glass-card rounded-3xl border border-gray-200/50 bg-white/60 shadow-lg hover:shadow-[0_10px_40px_rgba(0,229,153,0.15)] transition-all duration-500 hover:-translate-y-2 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/0 pointer-events-none z-10 rounded-3xl" />
        <div className="h-48 w-full bg-gray-100 relative overflow-hidden">
          {bannerSource ? (
            <img
              src={bannerSource}
              alt={`${app.name} banner`}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out"
              loading="lazy"
              decoding="async"
              onError={() => {
                setBannerIndex((prev) => (prev + 1 < bannerSources.length ? prev + 1 : bannerSources.length));
              }}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-sm font-semibold text-gray-500 group-hover:scale-110 transition-transform duration-700">
              {app.name}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10" />
        </div>

        <CardContent className="p-6 relative bg-transparent z-20 flex flex-col h-[220px]">
          <div className="absolute -top-10 left-6 z-30 p-1.5 bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/50 group-hover:-translate-y-2 transition-transform duration-500">
            <MiniAppLogo appId={app.app_id} category={app.category} entryUrl={app.entry_url} logoUrl={app.logo_url} manifest={app.manifest || null} size="lg" className="rounded-xl" />
          </div>

          <div className="flex justify-end gap-2 mb-5 h-6">
            <Badge className={cn(categoryColors[app.category], "border border-transparent capitalize px-2.5 py-0.5 text-[10px] font-bold tracking-wider")} variant="secondary">
              {app.category}
            </Badge>
            {app.status === "beta" && (
              <Badge className={cn(statusColors.beta, "px-2.5 py-0.5 tracking-wide text-[10px] font-bold uppercase")} variant="outline">
                Beta
              </Badge>
            )}
            {showSourceBadge && (
              <Badge className={cn(sourceColors[app.source ?? "community"], "px-2.5 py-0.5 tracking-wide text-[10px] font-bold backdrop-blur-md")} variant="outline">
                {app.source === "community" ? "Community" : "Verified"}
              </Badge>
            )}
          </div>

          <h3 className="min-w-0 truncate text-xl font-bold text-gray-900 mb-2 group-hover:text-neo transition-colors duration-300" title={app.name}>
            {app.name}
          </h3>

          <p className="line-clamp-2 text-sm font-medium leading-relaxed text-gray-600 flex-1" title={app.description}>
            {app.description}
          </p>

          <div className="border-t border-gray-200/50 pt-4 mt-auto flex items-center justify-end text-xs font-semibold text-gray-500">
            <div className="text-neo flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0 duration-300 transform">
              Launch <span aria-hidden="true">&rarr;</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
});
