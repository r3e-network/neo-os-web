import React, { useEffect, useMemo, useState } from "react";
import { MiniAppInfo } from "./types";
import { ArrowLeft } from "lucide-react";
import { isFlagshipMiniApp } from "@/lib/miniapp-showcase";
import { buildMiniAppBannerSources } from "@/lib/miniapp-media";

type Props = {
  app: MiniAppInfo;
  onBack: () => void;
};

export function AppDetailHeader({ app, onBack }: Props) {
  const isFlagship = isFlagshipMiniApp(app.app_id);
  const appSurface = app.contract_hash ? "Contract-backed" : "Launcher";
  let statusBadge = "Unavailable";
  let statusColor = "text-gray-500 bg-gray-100 border-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:border-gray-700";
  if (app.status === "active") {
    statusBadge = "Online";
    statusColor = "text-neo bg-neo/10 border-neo/20";
  } else if (app.status === "beta") {
    statusBadge = "Beta";
    statusColor = "text-sky-600 bg-sky-500/10 border-sky-500/20 dark:text-sky-300";
  } else if (app.status === "disabled") {
    statusBadge = "Maintenance";
    statusColor = "text-amber-500 bg-amber-500/10 border-amber-500/20";
  } else if (app.status === "pending") {
    statusBadge = "Pending";
    statusColor = "text-gray-500 bg-gray-100 border-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:border-gray-700";
  }

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
    <header className="relative border-b border-gray-200/50 dark:border-white/5 bg-white/40 dark:bg-[#0A0B10]/40 px-4 sm:px-8 pt-6 pb-8 sm:pt-10 sm:pb-12 overflow-hidden backdrop-blur-xl">
      {/* Hero banner image with gradient fallback */}
      {bannerSource ? (
        <img
          src={bannerSource}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-20 dark:opacity-15 pointer-events-none"
          onError={() => {
            setBannerIndex((prev) =>
              prev + 1 < bannerSources.length ? prev + 1 : bannerSources.length,
            );
          }}
        />
      ) : null}

      {/* Background glowing effects */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-neo/5 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-1/2 left-1/4 w-[400px] h-[400px] bg-[#7000FF]/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-[1280px] mx-auto relative z-10">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="mb-8 flex items-center gap-2 rounded-xl border border-transparent bg-gray-100/50 dark:bg-white/5 px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 transition-all cursor-pointer hover:bg-gray-200/50 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo shadow-sm w-fit group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform duration-300" />
          Back to MiniApps
        </button>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-8">
          <div className="flex h-20 w-20 sm:h-28 sm:w-28 shrink-0 items-center justify-center rounded-[2rem] bg-gradient-to-br from-white/60 to-white/10 dark:from-[#12131C] dark:to-[#0A0B10] text-[56px] sm:text-[72px] shadow-[0_8px_30px_rgba(0,0,0,0.05)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)] border border-gray-200/50 dark:border-white/10 relative group">
            <div className="absolute inset-0 rounded-[2rem] border border-neo/0 group-hover:border-neo/30 transition-colors duration-500" />
            <span className="transform group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500 drop-shadow-md">
              {app.icon}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="mb-3 text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tight truncate drop-shadow-sm" title={app.name}>
              {app.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              {isFlagship && (
                <span className="rounded-full border border-neo/30 bg-neo/10 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-neo">
                  Flagship
                </span>
              )}
              <span className="rounded-full bg-neo/15 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-neo border border-neo/20 shadow-[inset_0_0_10px_rgba(0,229,153,0.1)]">
                {app.category}
              </span>
              <span className="rounded-full border border-gray-200 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-gray-600 dark:border-white/10 dark:text-gray-300">
                {appSurface}
              </span>
              <span className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-widest border ${statusColor}`}>
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${app.status === 'active' ? 'bg-neo' : app.status === 'beta' ? 'bg-sky-400' : 'hidden'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${app.status === 'active' ? 'bg-neo' : app.status === 'beta' ? 'bg-sky-400' : 'bg-current'}`}></span>
                </span>
                {statusBadge}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
