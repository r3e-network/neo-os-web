import React, { useEffect, useMemo, useState } from "react";
import { MiniAppInfo } from "./types";
import { ArrowLeft } from "lucide-react";
import { isFlagshipMiniApp } from "@/lib/miniapp-showcase";
import {
  buildMiniAppBannerSources,
  buildModernImageSources,
} from "@/lib/miniapp-media";
import { MiniAppLogo } from "@/components/features/miniapp/MiniAppLogo";

type Props = {
  app: MiniAppInfo;
  onBack: () => void;
};

export function AppDetailHeader({ app, onBack }: Props) {
  const isFlagship = isFlagshipMiniApp(app.app_id);
  const appSurface = app.contract_hash ? "Contract-backed" : "MiniApp";
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
  const modernBannerSources = buildModernImageSources(bannerSource);

  return (
    <header className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
      <div className="mx-auto max-w-[1600px]">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="group mb-3 flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <ArrowLeft
            size={16}
            className="transition-transform duration-200 group-hover:-translate-x-0.5"
          />
          Back to MiniApps
        </button>

        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm sm:h-[72px] sm:w-[72px]">
              <MiniAppLogo
                appId={app.app_id}
                category={app.category}
                entryUrl={app.entry_url}
                logoUrl={app.logo_url}
                manifest={app.manifest || null}
                size="lg"
                className="h-full w-full rounded-lg"
                alt={app.name}
              />
            </div>

            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {isFlagship && (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase text-emerald-700">
                    Flagship
                  </span>
                )}
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase text-emerald-700">
                  {app.category}
                </span>
                <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold uppercase text-gray-600">
                  {appSurface}
                </span>
                <span
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase ${statusColor}`}
                >
                  <span className="relative flex h-2 w-2">
                    <span
                      className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${app.status === "active" ? "bg-emerald-500" : app.status === "beta" ? "bg-sky-400" : "hidden"}`}
                    />
                    <span
                      className={`relative inline-flex h-2 w-2 rounded-full ${app.status === "active" ? "bg-emerald-500" : app.status === "beta" ? "bg-sky-400" : "bg-current"}`}
                    />
                  </span>
                  {statusBadge}
                </span>
              </div>

              <h1
                className="m-0 truncate text-2xl font-black text-gray-900 sm:text-3xl"
                title={app.name}
              >
                {app.name}
              </h1>
              <p className="mt-1 line-clamp-2 max-w-4xl text-sm leading-5 text-gray-500">
                {app.description}
              </p>
            </div>
          </div>

          <div className="relative hidden h-24 w-64 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-slate-950 lg:block">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_30%,rgba(16,185,129,0.55),transparent_34%),radial-gradient(circle_at_82%_70%,rgba(14,165,233,0.35),transparent_34%),linear-gradient(135deg,#020617,#111827)]" />
            <div className="absolute inset-0 flex items-center gap-3 px-4 text-white">
              <MiniAppLogo
                appId={app.app_id}
                category={app.category}
                entryUrl={null}
                logoUrl={null}
                manifest={null}
                size="md"
                className="rounded-lg shadow-none"
                alt=""
              />
              <div className="min-w-0">
                <p className="m-0 truncate text-sm font-black">{app.name}</p>
                <p className="m-0 mt-1 truncate text-xs font-semibold text-white/65">
                  Integrated dApp runtime
                </p>
              </div>
            </div>
            {bannerSource ? (
              <picture className="absolute inset-0 block h-full w-full">
                {modernBannerSources.avif && (
                  <source srcSet={modernBannerSources.avif} type="image/avif" />
                )}
                {modernBannerSources.webp && (
                  <source srcSet={modernBannerSources.webp} type="image/webp" />
                )}
                <img
                  src={bannerSource}
                  alt=""
                  aria-hidden="true"
                  className="h-full w-full object-cover"
                  loading="eager"
                  decoding="async"
                  onError={() => {
                    setBannerIndex((prev) =>
                      prev + 1 < bannerSources.length
                        ? prev + 1
                        : bannerSources.length,
                    );
                  }}
                />
              </picture>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
