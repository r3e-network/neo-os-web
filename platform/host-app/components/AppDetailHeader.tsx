import React from "react";
import { MiniAppInfo, MiniAppStats } from "./types";
import { useI18n } from "@/lib/i18n/react";
import { MiniAppLogo } from "./features/miniapp/MiniAppLogo";

function isIconUrl(icon: string): boolean {
  if (!icon) return false;
  return icon.startsWith("/") || icon.startsWith("http") || icon.endsWith(".svg") || icon.endsWith(".png");
}

type Props = {
  app: MiniAppInfo;
  stats?: MiniAppStats;
};

export function AppDetailHeader({ app, stats }: Props) {
  const { locale } = useI18n();
  const appName = locale === "zh" && app.name_zh ? app.name_zh : app.name;

  let statusBadge = stats?.last_activity_at ? "Active" : "Inactive";
  let statusColorClass = stats?.last_activity_at ? "text-neo" : "text-gray-400";

  if (app.status === "active") {
    statusBadge = "Online";
    statusColorClass = "text-neo";
  } else if (app.status === "disabled") {
    statusBadge = "Maintenance";
    statusColorClass = "text-brutal-yellow";
  } else if (app.status === "pending") {
    statusBadge = "Pending";
    statusColorClass = "text-gray-400";
  }

  return (
    <header className="pt-28 pb-10 px-8 bg-white dark:bg-black border-b-4 border-black dark:border-white shadow-brutal-lg relative z-10 overflow-hidden">
      {/* Texture Pattern Background */}
      <div className="absolute top-0 right-0 w-64 h-64 opacity-10 bg-[radial-gradient(circle_at_1px_1px,#000_1px,transparent_0)] bg-[size:16px_16px] -rotate-12 translate-x-16 -translate-y-16 pointer-events-none" />

      <div className="flex items-center gap-8 relative">
        <div className="w-28 h-28 bg-neo border-4 border-black flex items-center justify-center shadow-brutal-md rotate-[-3deg] hover:rotate-0 transition-transform flex-shrink-0">
          {isIconUrl(app.icon) ? (
            <MiniAppLogo appId={app.app_id} category={app.category} size="lg" iconUrl={app.icon} />
          ) : (
            <span className="text-6xl">{app.icon}</span>
          )}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className="px-3 py-1 bg-brutal-yellow text-black border-2 border-black font-black uppercase text-[10px] shadow-brutal-xs rotate-[-1deg]">
              {app.category}
            </span>
            <span className={`px-3 py-1 border-2 border-black font-black uppercase text-[10px] shadow-brutal-xs rotate-[1deg] flex items-center gap-2 ${statusBadge === "Online" ? "bg-neo text-black" : "bg-gray-200 text-gray-500"
              }`}>
              <span className={`w-2 h-2 border border-black ${statusBadge === "Online" ? "bg-black animate-pulse" : "bg-gray-400"}`} />
              {statusBadge}
            </span>
          </div>
          <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tighter italic text-black dark:text-white leading-[0.9] drop-shadow-[4px_4px_0_rgba(0,0,0,0.2)]">
            {appName}
          </h1>
        </div>
      </div>
    </header>
  );
}
