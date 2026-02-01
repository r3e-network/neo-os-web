// Shared MiniApp Utilities
import type { MiniAppCategory, MiniAppInfo, MiniAppPermissions } from "./miniapp";

const VALID_CATEGORIES: MiniAppCategory[] = ["gaming", "defi", "governance", "utility", "social", "nft"];

export function normalizeCategory(value: unknown): MiniAppCategory {
  if (typeof value === "string" && VALID_CATEGORIES.includes(value as MiniAppCategory)) {
    return value as MiniAppCategory;
  }
  return "utility";
}

export function normalizePermissions(value: unknown): MiniAppPermissions {
  if (!value || typeof value !== "object") return {};
  const v = value as Record<string, unknown>;
  return {
    payments: Boolean(v.payments),
    governance: Boolean(v.governance),
    rng: Boolean(v.rng),
    datafeed: Boolean(v.datafeed),
    confidential: Boolean(v.confidential),
  };
}

export function filterByCategory(apps: MiniAppInfo[], category: MiniAppCategory | "all"): MiniAppInfo[] {
  if (category === "all") return apps;
  return apps.filter((app) => app.category === category);
}

export function searchApps(apps: MiniAppInfo[], query: string): MiniAppInfo[] {
  const q = query.toLowerCase().trim();
  if (!q) return apps;
  return apps.filter((app) => app.name.toLowerCase().includes(q) || app.description.toLowerCase().includes(q));
}
