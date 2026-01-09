import React from "react";
import { MiniAppInfo, MiniAppStats } from "./types";
import { useI18n } from "@/lib/i18n/react";
import { MiniAppLogo } from "./features/miniapp/MiniAppLogo";
import { Badge } from "@/components/ui/badge";

function isIconUrl(icon: string): boolean {
  if (!icon) return false;
  return icon.startsWith("/") || icon.startsWith("http") || icon.endsWith(".svg") || icon.endsWith(".png");
}

type Props = {
  app: MiniAppInfo;
  stats?: MiniAppStats;
  onClickBack?: () => void;
};

export function AppDetailHeader({ app, stats }: Props) {
  const { locale } = useI18n();
  const appName = locale === "zh" && app.name_zh ? app.name_zh : app.name;

  let statusBadge = stats?.last_activity_at ? "Active" : "Inactive";
  let statusColorClass = stats?.last_activity_at ? "text-neo" : "text-gray-400";
  let statusVariant: "default" | "secondary" | "destructive" | "outline" = "outline";

  if (app.status === "active") {
    statusBadge = "Online";
    statusColorClass = "text-neo";
    statusVariant = "default";
  } else if (app.status === "disabled") {
    statusBadge = "Maintenance";
    statusColorClass = "text-amber-500";
    statusVariant = "secondary";
  } else if (app.status === "pending") {
    statusBadge = "Pending";
    statusColorClass = "text-gray-400";
    statusVariant = "outline";
  }

  return (
    <header className="pt-28 pb-10 px-8 relative z-10 overflow-hidden bg-white/80 dark:bg-[#050505]/90 backdrop-blur-xl border-b border-gray-200 dark:border-white/10 transition-all duration-300">
      {/* E-Robo Background Glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-[var(--erobo-purple)]/20 to-transparent rounded-full blur-[100px] pointer-events-none -mr-32 -mt-32 opacity-70" />

      <div className="flex items-center gap-8 relative max-w-7xl mx-auto">
        <div className="w-28 h-28 rounded-3xl flex items-center justify-center flex-shrink-0 group hover:scale-105 transition-transform duration-300 relative z-20 overflow-hidden">
          {isIconUrl(app.icon) ? (
            <MiniAppLogo
              appId={app.app_id}
              category={app.category}
              size="lg"
              iconUrl={app.icon}
              className="w-full h-full rounded-3xl"
            />
          ) : (
            <div className="w-full h-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl flex items-center justify-center shadow-2xl backdrop-blur-xl">
              <span className="text-6xl transition-transform group-hover:scale-110 duration-300 inline-block drop-shadow-sm">
                {app.icon}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 relative z-20">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Badge
              variant="secondary"
              className="px-3 py-1 font-bold uppercase text-[10px] tracking-wider bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 shadow-sm border border-gray-300 dark:border-transparent"
            >
              {app.category}
            </Badge>
            <div
              className={`px-3 py-1 rounded-full font-bold uppercase text-[10px] tracking-wider flex items-center gap-2 border shadow-sm backdrop-blur-sm ${
                statusBadge === "Online"
                  ? "bg-neo/10 text-neo border-neo/20"
                  : statusBadge === "Maintenance"
                    ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                    : "bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/10"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  statusBadge === "Online"
                    ? "bg-neo animate-pulse shadow-[0_0_8px_currentColor]"
                    : "bg-current opacity-50"
                }`}
              />
              {statusBadge}
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white leading-tight tracking-tight drop-shadow-sm break-words bg-clip-text text-transparent bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 dark:from-white dark:via-gray-200 dark:to-white">
            {appName}
          </h1>
        </div>
      </div>
    </header>
  );
}
