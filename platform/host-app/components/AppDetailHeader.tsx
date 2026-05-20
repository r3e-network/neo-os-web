import React from "react";
import { MiniAppInfo } from "./types";
import { ArrowLeft } from "lucide-react";
import { isFlagshipMiniApp } from "@/lib/miniapp-showcase";
import { MiniAppLogo } from "@/components/features/miniapp/MiniAppLogo";

type Props = {
  app: MiniAppInfo;
  onBack: () => void;
};

/**
 * Polymarket-style compact detail header.
 * One sticky row, ~48px tall, so the play area stays above the fold.
 *   [< back] [icon] AppName · category · status   [appSurface chip]
 * The full description and banner live in the page status board / dApp itself.
 */
export function AppDetailHeader({ app, onBack }: Props) {
  const isFlagship = isFlagshipMiniApp(app.app_id);
  const appSurface = app.contract_hash ? "Contract" : "MiniApp";

  let statusLabel = "Unavailable";
  let statusDotClass = "bg-gray-400";
  let statusTextClass = "text-gray-500";
  if (app.status === "active") {
    statusLabel = "Online";
    statusDotClass = "bg-emerald-500";
    statusTextClass = "text-emerald-700";
  } else if (app.status === "beta") {
    statusLabel = "Beta";
    statusDotClass = "bg-sky-500";
    statusTextClass = "text-sky-700";
  } else if (app.status === "disabled") {
    statusLabel = "Maintenance";
    statusDotClass = "bg-amber-500";
    statusTextClass = "text-amber-700";
  } else if (app.status === "pending") {
    statusLabel = "Pending";
    statusDotClass = "bg-gray-400";
    statusTextClass = "text-gray-500";
  }

  return (
    <header className="sticky top-16 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-3 py-2 sm:px-5 sm:py-2.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="group flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-white">
          <MiniAppLogo
            appId={app.app_id}
            category={app.category}
            entryUrl={app.entry_url}
            logoUrl={app.logo_url}
            manifest={app.manifest || null}
            size="sm"
            className="h-full w-full"
            alt={app.name}
          />
        </div>
        <h1
          className="m-0 truncate text-sm font-bold text-gray-900 sm:text-base"
          title={app.name}
        >
          {app.name}
        </h1>
        <span className="hidden h-4 w-px shrink-0 bg-gray-200 sm:block" />
        <span className="hidden text-xs font-semibold capitalize text-gray-500 sm:inline">
          {app.category}
        </span>
        <span className="hidden h-4 w-px shrink-0 bg-gray-200 sm:block" />
        <span className="hidden items-center gap-1.5 text-xs font-semibold sm:inline-flex">
          <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass}`} />
          <span className={statusTextClass}>{statusLabel}</span>
        </span>
        {isFlagship && (
          <span className="hidden rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 sm:inline">
            Flagship
          </span>
        )}

        <div className="ml-auto hidden items-center gap-2 sm:flex">
          <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
            {appSurface}
          </span>
        </div>
      </div>
    </header>
  );
}
