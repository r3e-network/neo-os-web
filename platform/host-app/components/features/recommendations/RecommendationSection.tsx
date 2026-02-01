/**
 * RecommendationSection Component
 * Steam-style horizontal scrollable recommendation row
 */

"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/react";
import { MiniAppLogo } from "@/components/features/miniapp/MiniAppLogo";
import { getLocalizedField } from "@neo/shared/i18n";
import type { RecommendationSection as SectionType } from "./types";

type CategoryType = "gaming" | "defi" | "social" | "governance" | "utility" | "nft";

interface Props {
  section: SectionType;
  className?: string;
}

// Category-based background colors matching the design system
const CATEGORY_BG: Record<string, string> = {
  gaming: "bg-gradient-to-br from-erobo-peach/60 to-erobo-pink/40",
  defi: "bg-gradient-to-br from-erobo-mint/60 to-neo/40",
  social: "bg-gradient-to-br from-erobo-pink/50 to-erobo-purple/40",
  governance: "bg-gradient-to-br from-erobo-sky/60 to-erobo-purple/40",
  utility: "bg-gradient-to-br from-erobo-sky/50 to-erobo-mint/40",
  nft: "bg-gradient-to-br from-erobo-purple/50 to-erobo-pink/40",
};

export function RecommendationSection({ section, className }: Props) {
  const { t, locale } = useTranslation("host");

  if (section.apps.length === 0) return null;

  const title = section.titleKey ? t(section.titleKey) : section.title;

  return (
    <div className={cn("mb-8", className)}>
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-erobo-ink dark:text-white">{title}</h3>
          {section.reason && <p className="text-sm text-erobo-ink-soft/70 dark:text-white/50">{section.reason}</p>}
        </div>
        <Link
          href={`/miniapps?type=${section.type}`}
          className="flex items-center gap-1 text-sm text-erobo-purple hover:underline"
        >
          {t("recommendations.seeAll") || "See all"}
          <ChevronRight size={16} />
        </Link>
      </div>

      {/* Horizontal Scroll */}
      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
        {section.apps.map((app) => {
          const name = getLocalizedField(app, "name", locale);

          return (
            <Link key={app.app_id} href={`/miniapps/${app.app_id}`} className="flex-shrink-0 w-48 group">
              <div className="relative rounded-xl overflow-hidden bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 transition-all hover:shadow-lg hover:-translate-y-1">
                {/* Banner with category background and centered logo */}
                <div
                  className={cn(
                    "w-full h-28 flex items-center justify-center",
                    CATEGORY_BG[app.category] || CATEGORY_BG.utility,
                  )}
                >
                  <MiniAppLogo
                    appId={app.app_id}
                    category={app.category as CategoryType}
                    size="xl"
                    iconUrl={app.icon}
                  />
                </div>
                <div className="p-3">
                  <h4 className="font-medium text-sm text-erobo-ink dark:text-white truncate group-hover:text-erobo-purple transition-colors">
                    {name}
                  </h4>
                  <span className="text-xs text-gray-500 capitalize">{app.category}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
