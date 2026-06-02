import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { MiniAppInfo } from "@/components/types";
import type { Locale } from "@/lib/i18n";
import { Wrench } from "lucide-react";
import { HomeMiniAppRow } from "@/components/features/home/HomeMiniAppRow";

export function OperatorToolsSection({
  toolApps,
  catalogLoading,
  targetNetwork,
  locale,
  t,
}: {
  toolApps: MiniAppInfo[];
  catalogLoading: boolean;
  targetNetwork: string;
  locale: Locale;
  t: (key: string, ns?: "common" | "host" | "admin" | "miniapp") => string;
}) {
  return (
    <section className="bg-white px-4 py-14 sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-6 flex items-end justify-between gap-6">
          <div>
            <h2 className="m-0 text-2xl font-black text-gray-900 md:text-3xl">
              {t("home.tools.title", "host")}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
              {t("home.tools.description", "host")}
            </p>
          </div>
          <Link href={`/miniapps?network=${encodeURIComponent(targetNetwork)}`}>
            <Button
              variant="outline"
              className="rounded-full border-emerald-200 text-emerald-800 hover:bg-emerald-50"
            >
              {t("home.tools.browse", "host")}
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {catalogLoading ? (
            Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
            ))
          ) : toolApps && toolApps.length > 0 ? (
            toolApps.map((app) => (
              <HomeMiniAppRow
                key={app.app_id}
                app={app}
                targetNetwork={targetNetwork}
                locale={locale}
                t={t}
                spacious
              />
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 py-12 text-gray-500">
              <Wrench className="w-12 h-12 mb-3 text-gray-300" />
              <p className="text-base font-semibold">
                {t("home.tools.emptyTitle", "host")}
              </p>
              <p className="text-sm mt-1">
                {t("home.tools.emptyBody", "host")}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
