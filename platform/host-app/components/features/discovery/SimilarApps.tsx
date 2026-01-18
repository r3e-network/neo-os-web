"use client";

/**
 * SimilarApps - Steam-style similar apps recommendation section
 * Shows apps from the same category, excluding the current app
 */

import { useMemo } from "react";
import Link from "next/link";
import { MiniAppLogo } from "@/components/features/miniapp/MiniAppLogo";
import { ChainBadgeGroup } from "@/components/ui/ChainBadgeGroup";
import { useTranslation } from "@/lib/i18n/react";
import { BUILTIN_APPS } from "@/lib/builtin-apps";
import { ChevronRight } from "lucide-react";
import { getLocalizedField } from "@neo/shared/i18n";
import type { ChainId } from "@/lib/chains/types";

interface SimilarAppsProps {
  currentAppId: string;
  category: string;
  maxItems?: number;
}

export function SimilarApps({ currentAppId, category, maxItems = 4 }: SimilarAppsProps) {
  const { t, locale } = useTranslation("host");

  const similarApps = useMemo(() => {
    return BUILTIN_APPS.filter((app) => app.category === category && app.app_id !== currentAppId).slice(0, maxItems);
  }, [category, currentAppId, maxItems]);

  if (similarApps.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-erobo-ink dark:text-white">{t("detail.similarApps")}</h3>
        <Link
          href={`/miniapps?category=${category}`}
          className="flex items-center gap-1 text-sm text-erobo-purple hover:text-erobo-purple-dark transition-colors"
        >
          {t("detail.viewAll")}
          <ChevronRight size={16} />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {similarApps.map((app) => {
          const appName = getLocalizedField(app, "name", locale);
          return (
            <Link
              key={app.app_id}
              href={`/miniapps/${app.app_id}`}
              className="group flex items-center gap-3 p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-erobo-purple/10 hover:border-erobo-purple/30 hover:shadow-[0_0_20px_rgba(159,157,243,0.15)] transition-all"
            >
              <MiniAppLogo appId={app.app_id} category={app.category as any} size="md" iconUrl={app.icon} />
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm text-erobo-ink dark:text-white truncate group-hover:text-erobo-purple transition-colors">
                  {appName}
                </h4>
                <div className="flex items-center gap-2 mt-1">
                  {app.supportedChains && app.supportedChains.length > 0 && (
                    <ChainBadgeGroup chainIds={app.supportedChains as ChainId[]} size="sm" maxDisplay={2} />
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
