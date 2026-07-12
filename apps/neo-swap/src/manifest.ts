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
  description: "Timestamped NEO/GAS quote desk with slippage and settlement guards",
  icon: "repeat",
  category: "defi",
  shell: "launcher",

  // -- Tabs -------------------------------------------------------------------
  tabs: [
    { key: "swap", labelKey: "tabSwap", icon: "repeat", default: true },
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
    // Public Morpheus quotes do not require a wallet. A wallet is requested
    // only for optional balance reads or a future verified settlement route.
    walletRequired: false,
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

  // -- Permissions ------------------------------------------------------------
  permissions: {
    payments: false,
    datafeed: true,
  },
};
