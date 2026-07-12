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
  description:
    "A tactile Phaser coin-flip table with secure local streak play. Wallet-funded flips remain paused until the reviewed Neo N3 artifact is deployed and verified.",
  icon: "coin",
  category: "game",
  shell: "game",
  theme: { family: "gaming", accentColor: "#16a36a", density: "comfortable" },

  // The public deployments do not match the reviewed contract artifact. Keep
  // the polished local table available while every wallet-funded route fails
  // closed at the launcher, manifest and runtime layers.
  supportsGuest: true,
  supportsGameFi: false,

  gamePage: {
    categoryColor: "#16A36A",
    appIcon: "coin",
    modes: { guest: true, gamefi: false },
    heroBadgeKey: "guestModeBadge",
    heroTitleKey: "title",
    heroTitleAccent: "title",
    heroDescKey: "guestSubtitle",
    primaryLabelKey: "startAction",
    ghostLabelKey: "rulesTitle",
    featuresEyebrowKey: "guestModeBadge",
    featuresTitleKey: "rulesTitle",
    features: [
      { titleKey: "feature1Name", descKey: "feature1Desc", large: true },
      { titleKey: "feature2Name", descKey: "feature2Desc" },
      { titleKey: "feature3Name", descKey: "feature3Desc" },
    ],
    lbEyebrowKey: "guestModeBadge",
    lbTitleKey: "ranksTab",
    lbScoreLabelKey: "guestBestStreak",
    ctaTitleKey: "title",
    ctaDescKey: "guestFairnessNote",
    ctaLabelKey: "startAction",
    trustBadgeKeys: ["guestModeBadge", "secureLocalBadge", "gameFiPausedTitle"],
  },

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
    { labelKey: "guestStreak", valueKey: "streak", format: "number", variant: "accent", icon: "trending-up" },
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
      { labelKey: "guestStreak", valueKey: "streak", format: "number" },
    ],
  },

  // -- Features ---------------------------------------------------------------
  features: {
    fireworks: true,
    walletRequired: false,
    chainWarning: false,
  },

  // Phaser owns the coin, choices, flip action and recovery. Never surround it
  // with a second questionnaire-style platform operation form.
  operations: [],

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
  // FogPlay uses a custom payment flow: a direct GAS transfer commits the bet,
  // then a permissionless settle reveals the outcome from a later block.
  contract: {
    mode: "custom",
  },

  // -- Permissions ------------------------------------------------------------
  permissions: {
    payments: false,
    randomness: false,
  },
};
