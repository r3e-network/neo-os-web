import Link from "next/link";
import type { MiniAppInfo } from "@/components/types";
import type { Locale } from "@/lib/i18n";
import { HomeMiniAppRow } from "@/components/features/home/HomeMiniAppRow";

export function FeaturedAppsAside({
  featuredList,
  targetNetwork,
  locale,
  catalogLoading,
  t,
}: {
  featuredList: MiniAppInfo[];
  targetNetwork: string;
  locale: Locale;
  catalogLoading: boolean;
  t: (key: string, ns?: "common" | "host" | "admin" | "miniapp") => string;
}) {
  return (
    <aside
      className="self-start rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
      data-testid="homepage-featured-apps"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="m-0 text-xs font-semibold uppercase text-gray-600">
            {t("home.featured.eyebrow", "host")}
          </p>
          <h2 className="m-0 mt-1 text-lg font-bold text-gray-900">
            {t("home.featured.title", "host")}
          </h2>
        </div>
        <Link
          href={`/miniapps?network=${encodeURIComponent(targetNetwork)}`}
          className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:border-neo/40 hover:text-emerald-700"
        >
          {t("actions.viewAll")}
        </Link>
      </div>
      <div className="space-y-2">
        {featuredList.map((app) => (
          <HomeMiniAppRow
            key={app.app_id}
            app={app}
            targetNetwork={targetNetwork}
            locale={locale}
            t={t}
          />
        ))}
        {catalogLoading && featuredList.length === 0 && (
          <div className="space-y-2">
            {Array.from({ length: 9 }, (_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-xl bg-gray-100"
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
