"use client";

import { memo } from "react";
import Link from "next/link";
import { MiniAppLogo } from "./MiniAppLogo";
import { Badge } from "@/components/ui/badge";
import type { MiniAppInfo } from "@/components/types";
import { cn } from "@/lib/utils";

interface MiniAppListItemProps {
  app: MiniAppInfo;
}

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

const statusColors = {
  beta: "bg-sky-100 text-sky-800 border-sky-300",
};

export const MiniAppListItem = memo(function MiniAppListItem({ app }: MiniAppListItemProps) {
  return (
    <Link
      href={`/miniapps/${app.app_id}`}
      className="group block rounded-2xl border border-gray-200/50 bg-white/40 hover:bg-white/80 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo glass-panel hover:shadow-lg hover:-translate-y-1 overflow-hidden relative"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-white/40 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      <div className="flex items-center gap-5 px-5 py-4 relative z-10">
        {/* Logo */}
        <div className="shrink-0 p-1.5 bg-white/80 rounded-xl shadow-sm border border-gray-100 group-hover:scale-105 transition-transform duration-300">
          <MiniAppLogo appId={app.app_id} category={app.category} entryUrl={app.entry_url} logoUrl={app.logo_url} manifest={app.manifest || null} size="md" className="rounded-lg" />
        </div>

        {/* Content Grid */}
        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-center">
          {/* Main Info */}
          <div className="min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-1.5">
              <h3 className="font-bold text-lg text-gray-900 truncate group-hover:text-neo transition-colors" title={app.name}>
                {app.name}
              </h3>
              <Badge className={cn(categoryColors[app.category], "border border-transparent capitalize px-2 py-0.5 text-[10px] font-bold font-mono tracking-tight")} variant="secondary">
                {app.category}
              </Badge>
              {app.status === "beta" && (
                <Badge className={cn(statusColors.beta, "px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight")} variant="outline">
                  Beta
                </Badge>
              )}
            </div>
            <p className="text-sm font-medium text-gray-500 truncate" title={app.description}>{app.description}</p>
          </div>

          <div className="hidden sm:flex items-center gap-6 text-xs font-semibold text-gray-500 group-hover:text-gray-900 transition-colors">
            <div className="flex items-center gap-1 justify-end text-neo opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-300">
              <span className="font-bold">Launch &rarr;</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
});
