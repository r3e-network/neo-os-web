import Link from "next/link";
import { cn } from "@/lib/utils";
import { MiniAppLogo } from "@/components/features/miniapp/MiniAppLogo";
import type { MiniAppInfo } from "@/components/types";
import { getMiniAppCatalogAvailability } from "@/lib/miniapp-catalog-view";
import {
  getAvailabilityLabel,
  getLocalizedMiniAppDescription,
  getLocalizedMiniAppName,
} from "@/lib/i18n/miniapp-display";
import type { Locale } from "@/lib/i18n";
import { getCategoryTheme } from "@/lib/category-theme";
import { ArrowUpRight } from "lucide-react";

export function HomeMiniAppRow({
  app,
  spacious = false,
  targetNetwork,
  locale,
  t,
}: {
  app: MiniAppInfo;
  spacious?: boolean;
  targetNetwork: string;
  locale: Locale;
  t: (key: string, ns?: "common" | "host" | "admin" | "miniapp") => string;
}) {
  const availability = getMiniAppCatalogAvailability(app, targetNetwork);
  const appName = getLocalizedMiniAppName(app, locale);
  const appDescription = getLocalizedMiniAppDescription(app, locale);
  const availabilityLabel = getAvailabilityLabel(
    availability.tone,
    availability.label,
    t,
  );
  const theme = getCategoryTheme(app.category);
  const isLive = availability.tone === "live";
  const detailHref = `/miniapps/${app.app_id}?network=${encodeURIComponent(targetNetwork)}`;
  const statusClass =
    availability.tone === "live"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : availability.tone === "pending"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : availability.tone === "unsupported"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : "border-gray-200 bg-gray-50 text-gray-500";
  return (
    <Link
      href={detailHref}
      className={cn(
        "group relative flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-gray-200 bg-white p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50",
        spacious && "p-4",
      )}
      style={{
        // hover border picks up the category accent via CSS var
        ["--category-accent" as string]: theme.accent,
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.borderColor = theme.accent;
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.borderColor = "";
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 bottom-0 w-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{ backgroundColor: theme.accent }}
      />
      <MiniAppLogo
        appId={app.app_id}
        category={app.category}
        entryUrl={app.entry_url}
        logoUrl={app.logo_url}
        manifest={app.manifest || null}
        size={spacious ? "lg" : "md"}
        className="shrink-0"
        alt={appName}
      />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="shrink-0 h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: theme.accent }}
            title={String(app.category || "")}
          />
          <span className="truncate text-sm font-bold text-gray-900">
            {appName}
          </span>
          <span
            className={cn(
              "shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase",
              statusClass,
            )}
          >
            {isLive && (
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-dot"
              />
            )}
            {availabilityLabel}
          </span>
        </span>
        <span className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">
          {appDescription}
        </span>
      </span>
      <ArrowUpRight
        className="h-4 w-4 shrink-0 text-gray-400 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
        style={{ color: undefined }}
        aria-hidden="true"
      />
    </Link>
  );
}
