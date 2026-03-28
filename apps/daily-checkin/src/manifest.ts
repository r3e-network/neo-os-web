/**
 * Daily Check-in Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the miniapp *except* the play area.
 *
 * The platform reads this manifest and renders:
 *   - Tabs (check-in, stats, docs)
 *   - Sidebar items bound to reactive state keys
 *   - Stats grid cards bound to reactive state keys
 *   - Docs / how-it-works section
 *   - Feature flags (fireworks, wallet requirement, etc.)
 *
 * The miniapp itself only provides PlayArea.vue (the unique check-in UI)
 * and useCheckin.ts (domain logic). Everything else is driven by this file.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  // ── Identity ─────────────────────────────────────────────────────────
  name: "Daily Check-in",
  description: "Check in daily to earn GAS rewards",
  icon: "check-circle",
  category: "game",
  shell: "launcher",

  // ── Tabs ──────────────────────────────────────────────────────────────
  // The platform appends a "docs" tab automatically via defineMiniApp.
  tabs: [
    { key: "checkin", labelKey: "checkin", icon: "check-circle", default: true },
    { key: "stats", labelKey: "stats", icon: "bar-chart" },
  ],

  // ── Stats Grid ────────────────────────────────────────────────────────
  // Rendered inside the stats tab. Each entry binds an i18n label key to a
  // reactive state key from the setup() return value. The platform looks up
  // `state[valueKey].value` and formats it according to `format`.
  stats: [
    { labelKey: "currentStreak", valueKey: "currentStreak", format: "text", variant: "accent", icon: "flame" },
    { labelKey: "highestStreak", valueKey: "highestStreak", format: "text", icon: "award" },
    { labelKey: "totalUserCheckins", valueKey: "totalUserCheckins", format: "number", icon: "check-circle" },
    { labelKey: "unclaimed", valueKey: "unclaimedRewards", format: "gas", variant: "success", icon: "gift" },
    { labelKey: "totalClaimed", valueKey: "totalClaimed", format: "gas", icon: "dollar-sign" },
    { labelKey: "totalCheckins", valueKey: "totalGlobalCheckins", format: "number", icon: "globe" },
    { labelKey: "totalUsers", valueKey: "totalGlobalUsers", format: "number", icon: "users" },
    { labelKey: "totalRewarded", valueKey: "totalGlobalRewarded", format: "gas", icon: "trending-up" },
  ],

  // ── Sidebar ───────────────────────────────────────────────────────────
  // Persistent info panel on the left. Values are resolved from the same
  // reactive state object returned by setup(). The `format` field controls
  // how the value is displayed (number, gas, text, etc.).
  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "currentStreak", valueKey: "currentStreak", format: "text" },
      { labelKey: "highestStreak", valueKey: "highestStreak", format: "text" },
      { labelKey: "totalUserCheckins", valueKey: "totalUserCheckins", format: "number" },
      { labelKey: "unclaimed", valueKey: "unclaimedRewards", format: "gas" },
      { labelKey: "totalClaimed", valueKey: "totalClaimed", format: "gas" },
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
  // The `type` field determines the layout: "text" for prose, "steps" for
  // numbered instructions, "features" for feature descriptions.
  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],

  // ── Contract ──────────────────────────────────────────────────────────
  // The check-in contract uses a custom payment flow (direct GAS transfer
  // with memo), not the standard operation-box pattern.
  contract: {
    mode: "custom",
  },

  // ── Permissions ───────────────────────────────────────────────────────
  permissions: {
    payments: true,
  },
};
