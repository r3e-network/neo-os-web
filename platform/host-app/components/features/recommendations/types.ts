/**
 * Recommendation System Types
 * Steam-inspired personalized recommendations
 */

export interface RecommendationSection {
  id: string;
  title: string;
  titleKey?: string; // i18n key
  type: "similar" | "category" | "new" | "trending" | "friends";
  apps: RecommendedApp[];
  reason?: string; // e.g., "Because you used Lottery"
}

export interface RecommendedApp {
  app_id: string;
  name: string;
  name_zh?: string;
  description: string;
  description_zh?: string;
  icon: string;
  category: string;
  score?: number; // recommendation score
  reason?: string;
}

export interface UserActivity {
  app_id: string;
  last_used: number;
  use_count: number;
}

export const RECENT_APPS_KEY = "neohub_recent_apps";
export const MAX_RECENT_APPS = 10;
