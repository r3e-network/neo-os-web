import type { MiniAppCategory, MiniAppInfo } from "@/components/types";
import { FLAGSHIP_MINIAPP_IDS } from "./miniapp-builtins";

export const TOOL_MINIAPP_IDS = [
  "miniapp-aa-account-lab",
  "miniapp-aa-permissions-lab",
  "miniapp-aa-market-hub",
  "miniapp-aa-relay-console",
  "miniapp-aa-session-key-lab",
  "miniapp-neo-x-bridge",
  "miniapp-flamingo-swap",
  "miniapp-flamingo-lend",
  "miniapp-flamingo-earn",
  "miniapp-flamingo-analytics",
  "miniapp-flamingo-action-center",
  "miniapp-oracle-price-console",
  "miniapp-oracle-seal-console",
  "miniapp-oracle-neodid-console",
  "miniapp-oracle-http-console",
  "miniapp-oracle-compute-lab",
  "miniapp-oracle-vrf-console",
] as const;

type MiniAppSortMode = "featured" | "name" | "recent";

const flagshipRank = new Map<string, number>(FLAGSHIP_MINIAPP_IDS.map((appId, index) => [appId, index]));
const toolRank = new Map<string, number>(TOOL_MINIAPP_IDS.map((appId, index) => [appId, index]));
const sourceRank: Record<string, number> = {
  verified: 0,
  miniapp: 1,
  community: 2,
};

export function isFlagshipMiniApp(appId: string): boolean {
  return flagshipRank.has(appId);
}

export function isToolMiniApp(appId: string): boolean {
  return toolRank.has(appId as (typeof TOOL_MINIAPP_IDS)[number]);
}

export function filterMiniAppsByCategory(apps: MiniAppInfo[], category: string): MiniAppInfo[] {
  if (!category || category === "all") return apps;
  return apps.filter((app) => app.category === category);
}

export function sortMiniApps(apps: MiniAppInfo[], sortMode: MiniAppSortMode = "featured"): MiniAppInfo[] {
  const next = [...apps];
  if (sortMode === "recent") return next;
  next.sort((left, right) => {
    if (sortMode === "name") {
      return left.name.localeCompare(right.name);
    }

    const leftFlagship = flagshipRank.get(left.app_id);
    const rightFlagship = flagshipRank.get(right.app_id);
    if (leftFlagship !== undefined || rightFlagship !== undefined) {
      if (leftFlagship === undefined) return 1;
      if (rightFlagship === undefined) return -1;
      if (leftFlagship !== rightFlagship) return leftFlagship - rightFlagship;
    }

    const leftTool = toolRank.get(left.app_id);
    const rightTool = toolRank.get(right.app_id);
    if (leftTool !== undefined || rightTool !== undefined) {
      if (leftTool === undefined) return 1;
      if (rightTool === undefined) return -1;
      if (leftTool !== rightTool) return leftTool - rightTool;
    }

    const leftSource = sourceRank[left.source || "miniapp"] ?? 99;
    const rightSource = sourceRank[right.source || "miniapp"] ?? 99;
    if (leftSource !== rightSource) return leftSource - rightSource;

    return left.name.localeCompare(right.name);
  });
  return next;
}

export function buildCategoryCounts(apps: MiniAppInfo[]): Record<MiniAppCategory | "all", number> {
  const counts: Record<MiniAppCategory | "all", number> = {
    all: apps.length,
    gaming: 0,
    defi: 0,
    governance: 0,
    utility: 0,
    social: 0,
    nft: 0,
    data: 0,
    other: 0,
  };

  for (const app of apps) {
    counts[app.category] += 1;
  }

  return counts;
}

export function partitionMiniApps(apps: MiniAppInfo[]): {
  flagship: MiniAppInfo[];
  tools: MiniAppInfo[];
  others: MiniAppInfo[];
} {
  const flagship: MiniAppInfo[] = [];
  const tools: MiniAppInfo[] = [];
  const others: MiniAppInfo[] = [];

  for (const app of sortMiniApps(apps, "featured")) {
    if (isFlagshipMiniApp(app.app_id)) {
      flagship.push(app);
      continue;
    }
    if (isToolMiniApp(app.app_id)) {
      tools.push(app);
      continue;
    }
    others.push(app);
  }

  return { flagship, tools, others };
}
