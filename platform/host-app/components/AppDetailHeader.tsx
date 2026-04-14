import React, { useEffect, useMemo, useState } from "react";
import { MiniAppInfo } from "./types";
import { ArrowLeft } from "lucide-react";
import { isFlagshipMiniApp } from "@/lib/miniapp-showcase";
import { buildMiniAppBannerSources, resolveMiniAppSlug } from "@/lib/miniapp-media";

type Props = {
  app: MiniAppInfo;
  onBack: () => void;
};

export function AppDetailHeader({ app, onBack }: Props) {
  const isFlagship = isFlagshipMiniApp(app.app_id);
  const appSurface = app.contract_hash ? "Contract-backed" : "Launcher";
  let statusBadge = "Unavailable";
  let statusColor = "text-gray-500 bg-gray-100 border-gray-200";
  if (app.status === "active") {
    statusBadge = "Online";
    statusColor = "text-emerald-700 bg-emerald-50 border-emerald-200";
  } else if (app.status === "beta") {
    statusBadge = "Beta";
    statusColor = "text-sky-700 bg-sky-50 border-sky-200";
  } else if (app.status === "disabled") {
    statusBadge = "Maintenance";
    statusColor = "text-amber-700 bg-amber-50 border-amber-200";
  } else if (app.status === "pending") {
    statusBadge = "Pending";
    statusColor = "text-gray-500 bg-gray-100 border-gray-200";
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
    <header className="relative border-b border-gray-200 bg-white px-4 sm:px-8 pt-6 pb-8 sm:pt-10 sm:pb-12 overflow-hidden">
      {/* Hero banner background */}
      {bannerSource ? (
        <img
          src={bannerSource}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-10 pointer-events-none"
          onError={() => {
            setBannerIndex((prev) =>
              prev + 1 < bannerSources.length ? prev + 1 : bannerSources.length,
            );
          }}
        />
      ) : null}

      <div className="max-w-[1280px] mx-auto relative z-10">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="mb-8 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 transition-all cursor-pointer hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 shadow-sm w-fit group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform duration-300" />
          Back to MiniApps
        </button>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-8">
          <div className="flex h-20 w-20 sm:h-28 sm:w-28 shrink-0 items-center justify-center rounded-[2rem] bg-white shadow-lg border border-gray-200 relative group overflow-hidden p-2">
            <img
              src={`/miniapp-assets/${resolveMiniAppSlug(app.app_id, app.entry_url)}/logo.svg`}
              alt={app.name}
              className="w-full h-full rounded-xl transform group-hover:scale-110 transition-transform duration-500"
              loading="eager"
              decoding="async"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = "none";
                const parent = target.parentElement;
                if (parent) {
                  const fallback = document.createElement("span");
                  fallback.className = "text-[56px] sm:text-[72px] drop-shadow-md";
                  fallback.textContent = app.icon || "\uD83D\uDCF1";
                  parent.appendChild(fallback);
                }
              }}
            />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="mb-3 text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 tracking-tight truncate" title={app.name}>
              {app.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              {isFlagship && (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-emerald-700">
                  Flagship
                </span>
              )}
              <span className="rounded-full bg-emerald-50 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-emerald-700 border border-emerald-200">
                {app.category}
              </span>
              <span className="rounded-full border border-gray-200 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-gray-600">
                {appSurface}
              </span>
              <span className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-widest border ${statusColor}`}>
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${app.status === "active" ? "bg-emerald-500" : app.status === "beta" ? "bg-sky-400" : "hidden"}`} />
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${app.status === "active" ? "bg-emerald-500" : app.status === "beta" ? "bg-sky-400" : "bg-current"}`} />
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
