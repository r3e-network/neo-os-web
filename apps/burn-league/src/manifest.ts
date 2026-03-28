/**
 * Burn League Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the miniapp *except* the play area.
 *
 * The platform reads this manifest and renders:
 *   - Tabs (burn, leaderboard, stats, docs)
 *   - Sidebar items bound to reactive state keys
 *   - Stats grid cards bound to reactive state keys
 *   - Docs / how-it-works section
 *   - Feature flags (fireworks, wallet requirement, etc.)
 *
 * The miniapp itself only provides PlayArea.vue (the unique burn UI)
 * and useBurnLeague.ts (domain logic). Everything else is driven by this file.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  // ── Identity ─────────────────────────────────────────────────────────
  name: "Burn League",
  description: "Burn tokens, earn rewards",
  icon: "flame",
  category: "game",
  shell: "launcher",

  // ── Tabs ──────────────────────────────────────────────────────────────
  // The platform appends a "docs" tab automatically via defineMiniApp.
  tabs: [
    { key: "burn", labelKey: "burnTokens", icon: "flame", default: true },
    { key: "leaderboard", labelKey: "leaderboard", icon: "bar-chart" },
    { key: "stats", labelKey: "stats", icon: "trending-up" },
  ],

  // ── Stats Grid ────────────────────────────────────────────────────────
  // Rendered inside the stats tab. Each entry binds an i18n label key to a
  // reactive state key from the setup() return value. The platform looks up
  // `state[valueKey].value` and formats it according to `format`.
  stats: [
    { labelKey: "totalBurned", valueKey: "totalBurned", format: "gas", variant: "danger", icon: "flame" },
    { labelKey: "youBurned", valueKey: "userBurned", format: "gas", variant: "accent", icon: "zap" },
    { labelKey: "rank", valueKey: "formattedRank", format: "text", icon: "award" },
    { labelKey: "sidebarBurns", valueKey: "burnCount", format: "number", icon: "hash" },
    { labelKey: "sidebarRewardPool", valueKey: "rewardPool", format: "gas", variant: "success", icon: "gift" },
    { labelKey: "leaderboard", valueKey: "leaderboardSize", format: "number", icon: "users" },
  ],

  // ── Sidebar ───────────────────────────────────────────────────────────
  // Persistent info panel on the left. Values are resolved from the same
  // reactive state object returned by setup(). The `format` field controls
  // how the value is displayed (number, gas, text, etc.).
  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "totalBurned", valueKey: "totalBurnedDisplay", format: "text" },
      { labelKey: "youBurned", valueKey: "userBurnedDisplay", format: "text" },
      { labelKey: "sidebarRank", valueKey: "formattedRank", format: "text" },
      { labelKey: "sidebarBurns", valueKey: "burnCount", format: "number" },
      { labelKey: "sidebarRewardPool", valueKey: "rewardPoolDisplay", format: "text" },
    ],
  },

  // ── Features ──────────────────────────────────────────────────────────
  features: {
    fireworks: true,
    walletRequired: true,
    chainWarning: true,
  },

  // ── Docs (How It Works) ───────────────────────────────────────────────
  // Array of documentation sections rendered in the docs tab.
  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],

  // ── Contract ──────────────────────────────────────────────────────────
  // The burn league uses a custom payment flow (direct GAS transfer
  // to contract with memo), not the standard operation-box pattern.
  contract: {
    mode: "custom",
  },

  // ── Permissions ───────────────────────────────────────────────────────
  permissions: {
    payments: true,
  },
};
