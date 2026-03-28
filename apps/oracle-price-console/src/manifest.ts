/**
 * Oracle Price Console Manifest
 *
 * Declarative configuration for the Oracle price feed console.
 * Queries Morpheus price feed from MiniApps.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  // -- Identity ---------------------------------------------------------------
  name: "Oracle Price Console",
  description: "Query Morpheus price feed from MiniApps",
  icon: "trending-up",
  category: "oracle",
  shell: "console",

  // -- Tabs -------------------------------------------------------------------
  tabs: [
    { key: "price", labelKey: "latestPrice", icon: "trending-up", default: true },
  ],

  // -- Stats ------------------------------------------------------------------
  stats: [
    { labelKey: "network", valueKey: "networkDisplay", format: "text", icon: "globe" },
    { labelKey: "heroFeed", valueKey: "datafeedShort", format: "text", icon: "activity" },
    { labelKey: "latestPrice", valueKey: "priceDisplay", format: "text", variant: "accent" },
    { labelKey: "overviewOracle", valueKey: "oracleHash", format: "text", variant: "accent" },
  ],

  // -- Sidebar ----------------------------------------------------------------
  sidebar: {
    titleKey: "appName",
    items: [
      { labelKey: "asset", valueKey: "asset", format: "text" },
      { labelKey: "latestPrice", valueKey: "priceDisplay", format: "text" },
    ],
  },

  // -- Features ---------------------------------------------------------------
  features: {
    walletRequired: false,
  },

  // -- Docs -------------------------------------------------------------------
  docs: [
    { titleKey: "appName", contentKey: "docsSubtitle", type: "text" },
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
    compute: true,
  },
};
