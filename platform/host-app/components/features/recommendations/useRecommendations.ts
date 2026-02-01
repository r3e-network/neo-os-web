/**
 * useRecommendations Hook
 * Generates personalized recommendations based on user activity
 */

import { useMemo } from "react";
import { BUILTIN_APPS } from "@/lib/builtin-apps";
import { useRecentApps } from "./useRecentApps";
import type { RecommendationSection, RecommendedApp } from "./types";

export function useRecommendations() {
  const { recentApps, getMostUsedAppId } = useRecentApps();

  const sections = useMemo(() => {
    const result: RecommendationSection[] = [];
    const mostUsedId = getMostUsedAppId();

    // 1. "Because you used X" - Similar apps
    if (mostUsedId) {
      const baseApp = BUILTIN_APPS.find((a) => a.app_id === mostUsedId);
      if (baseApp) {
        const similar = BUILTIN_APPS.filter((a) => a.category === baseApp.category && a.app_id !== mostUsedId).slice(
          0,
          6,
        );

        if (similar.length > 0) {
          result.push({
            id: "similar",
            title: `Because you used ${baseApp.name}`,
            type: "similar",
            reason: `Apps similar to ${baseApp.name}`,
            apps: mapToRecommended(similar),
          });
        }
      }
    }

    // 2. "New & Noteworthy"
    const newApps = [...BUILTIN_APPS].reverse().slice(0, 6);
    result.push({
      id: "new",
      title: "New & Noteworthy",
      titleKey: "recommendations.newNoteworthy",
      type: "new",
      apps: mapToRecommended(newApps),
    });

    // 3. "Popular in Gaming"
    const gaming = BUILTIN_APPS.filter((a) => a.category === "gaming").slice(0, 6);
    if (gaming.length > 0) {
      result.push({
        id: "gaming",
        title: "Popular in Gaming",
        titleKey: "recommendations.popularGaming",
        type: "category",
        apps: mapToRecommended(gaming),
      });
    }

    // 4. "DeFi Essentials"
    const defi = BUILTIN_APPS.filter((a) => a.category === "defi").slice(0, 6);
    if (defi.length > 0) {
      result.push({
        id: "defi",
        title: "DeFi Essentials",
        titleKey: "recommendations.defiEssentials",
        type: "category",
        apps: mapToRecommended(defi),
      });
    }

    return result;
  }, [recentApps, getMostUsedAppId]);

  return { sections };
}

function mapToRecommended(apps: typeof BUILTIN_APPS): RecommendedApp[] {
  return apps.map((app) => ({
    app_id: app.app_id,
    name: app.name,
    name_zh: app.name_zh,
    description: app.description,
    description_zh: app.description_zh,
    icon: app.icon,
    category: app.category,
  }));
}
