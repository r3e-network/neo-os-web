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
  description: "Read exact six-decimal Morpheus price signals with inspectable aggregate and provider routes",
  icon: "trending-up",
  category: "oracle",
  shell: "console",

  // -- Tabs -------------------------------------------------------------------
  tabs: [
    { key: "price", labelKey: "latestPrice", icon: "trending-up", default: true },
  ],

  // -- Stats ------------------------------------------------------------------
  // `latestPrice` binds the ONE `priceDisplay` observable and declares
  // `pendingKey`: the shell renders no gate of its own, so while the feed read
  // is in flight `priceDisplay` holds `undefined` and the chrome says "Awaiting
  // read" instead of a void — never the fabricated "N/A" the old display-only
  // twin printed. A settled-but-empty read arrives as its own "unavailable"
  // reading, not as this pending copy. See hooks/usePriceConsole.ts.
  stats: [
    // labelKey must resolve in the locale map — "network" had no key and rendered
    // as a blank label in production; use the existing priceMetricNetwork key.
    { labelKey: "priceMetricNetwork", valueKey: "networkDisplay", format: "text", icon: "globe" },
    { labelKey: "heroFeed", valueKey: "datafeedShort", format: "text", icon: "activity" },
    { labelKey: "latestPrice", valueKey: "priceDisplay", format: "text", variant: "accent", pendingKey: "priceSignalIdle" },
    { labelKey: "priceMetricSource", valueKey: "sourceLabel", format: "text" },
  ],

  // -- Sidebar ----------------------------------------------------------------
  sidebar: {
    titleKey: "appName",
    items: [
      { labelKey: "asset", valueKey: "asset", format: "text" },
      { labelKey: "latestPrice", valueKey: "priceDisplay", format: "text", pendingKey: "priceSignalIdle" },
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

  // -- Permissions ------------------------------------------------------------
  permissions: {
    datafeed: true,
  },
};
