/**
 * FogPlay (Coin Flip) Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the miniapp *except* the play area.
 *
 * The platform reads this manifest and renders:
 *   - Tabs (game, history, stats, docs)
 *   - Sidebar items bound to reactive state keys
 *   - Stats grid cards bound to reactive state keys
 *   - Docs / how-it-works section
 *   - Feature flags (fireworks, wallet requirement, etc.)
 *
 * The miniapp itself only provides PlayArea.vue (the unique game UI)
 * and useCoinFlip.ts (domain logic). Everything else is driven by this file.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  // -- Identity ---------------------------------------------------------------
  name: "FogPlay",
  description: "Oracle-backed coin toss with on-chain escrow",
  icon: "coin",
  category: "game",
  shell: "game",

  // -- Tabs -------------------------------------------------------------------
  // The platform appends a "docs" tab automatically via defineMiniApp.
  tabs: [
    { key: "game", labelKey: "game", icon: "gamepad", default: true },
    { key: "history", labelKey: "history", icon: "list" },
    { key: "stats", labelKey: "stats", icon: "bar-chart" },
  ],

  // -- Stats Grid -------------------------------------------------------------
  // Rendered inside the stats tab. Each entry binds an i18n label key to a
  // reactive state key from the setup() return value.
  stats: [
    { labelKey: "totalGames", valueKey: "totalGames", format: "number", icon: "gamepad" },
    { labelKey: "wins", valueKey: "wins", format: "number", variant: "success", icon: "award" },
    { labelKey: "losses", valueKey: "losses", format: "number", variant: "danger", icon: "x-circle" },
    { labelKey: "totalWon", valueKey: "formattedTotalWon", format: "text", variant: "accent", icon: "trending-up" },
  ],

  // -- Sidebar ----------------------------------------------------------------
  // Persistent info panel on the left. Values are resolved from the same
  // reactive state object returned by setup().
  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "totalGames", valueKey: "totalGames", format: "number" },
      { labelKey: "wins", valueKey: "wins", format: "number" },
      { labelKey: "losses", valueKey: "losses", format: "number" },
      { labelKey: "totalWon", valueKey: "formattedTotalWon", format: "text" },
    ],
  },

  // -- Features ---------------------------------------------------------------
  features: {
    fireworks: true,
    walletRequired: true,
    chainWarning: true,
  },

  // -- Docs (How It Works) ----------------------------------------------------
  // Array of documentation sections rendered in the docs tab.
  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step1", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
    { titleKey: "feature2Name", contentKey: "feature2Desc", type: "features" },
    { titleKey: "feature3Name", contentKey: "feature3Desc", type: "features" },
  ],

  // -- Contract ---------------------------------------------------------------
  // FogPlay uses a custom payment flow (direct GAS transfer + oracle VRF).
  contract: {
    mode: "custom",
  },

  // -- Permissions ------------------------------------------------------------
  permissions: {
    payments: true,
    randomness: true,
  },
};
