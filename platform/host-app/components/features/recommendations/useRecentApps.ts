/**
 * useRecentApps Hook
 * Tracks recently used apps for personalized recommendations
 */

import { useState, useEffect, useCallback } from "react";
import { UserActivity, RECENT_APPS_KEY, MAX_RECENT_APPS } from "./types";

export function useRecentApps() {
  const [recentApps, setRecentApps] = useState<UserActivity[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_APPS_KEY);
      if (stored) {
        setRecentApps(JSON.parse(stored));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const trackAppUsage = useCallback((appId: string) => {
    if (!appId) return;

    setRecentApps((prev) => {
      const existing = prev.find((a) => a.app_id === appId);
      let updated: UserActivity[];

      if (existing) {
        updated = prev.map((a) =>
          a.app_id === appId ? { ...a, last_used: Date.now(), use_count: a.use_count + 1 } : a,
        );
      } else {
        updated = [{ app_id: appId, last_used: Date.now(), use_count: 1 }, ...prev].slice(0, MAX_RECENT_APPS);
      }

      // Sort by last_used
      updated.sort((a, b) => b.last_used - a.last_used);

      try {
        localStorage.setItem(RECENT_APPS_KEY, JSON.stringify(updated));
      } catch {
        // Ignore
      }

      return updated;
    });
  }, []);

  const getMostUsedAppId = useCallback(() => {
    if (recentApps.length === 0) return null;
    return recentApps.reduce((max, app) => (app.use_count > max.use_count ? app : max)).app_id;
  }, [recentApps]);

  return { recentApps, trackAppUsage, getMostUsedAppId };
}
