/**
 * Neo Swap Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the neo-swap miniapp except the play area.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  // -- Identity ---------------------------------------------------------------
  name: "Neo Swap",
  description: "Token swap interface for Neo N3 — swap NEO, GAS, and NEP-17 tokens",
  icon: "repeat",
  category: "defi",
  shell: "launcher",

  // -- Tabs -------------------------------------------------------------------
  tabs: [
    { key: "swap", labelKey: "tabSwap", icon: "repeat", default: true },
    { key: "pool", labelKey: "tabPool", icon: "droplet" },
  ],

  // -- Stats Grid -------------------------------------------------------------
  stats: [
    { labelKey: "tabSwap", valueKey: "selectedPairDisplay", format: "text", variant: "accent", icon: "repeat" },
    { labelKey: "popularPairs", valueKey: "pairCount", format: "number", icon: "bar-chart" },
    { labelKey: "sidebarRate", valueKey: "currentRate", format: "text", icon: "trending-up" },
  ],

  // -- Sidebar ----------------------------------------------------------------
  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "tabSwap", valueKey: "selectedPairDisplay", format: "text" },
      { labelKey: "popularPairs", valueKey: "pairCount", format: "number" },
      { labelKey: "sidebarRate", valueKey: "currentRate", format: "text" },
    ],
  },

  // -- Features ---------------------------------------------------------------
  features: {
    walletRequired: true,
    chainWarning: true,
  },

  // -- Docs -------------------------------------------------------------------
  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
    { titleKey: "feature2Name", contentKey: "feature2Desc", type: "features" },
    { titleKey: "feature3Name", contentKey: "feature3Desc", type: "features" },
  ],

  // -- Contract ---------------------------------------------------------------
  contract: {
    mode: "custom",
  },

  // -- Permissions ------------------------------------------------------------
  permissions: {
    payments: true,
  },
};
