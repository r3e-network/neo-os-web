/**
 * Gov Merc Manifest
 *
 * Declarative configuration for the governance mercenary pool miniapp.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Gov Merc",
  description: "Neo governance mercenary pool for vote renting",
  icon: "shield",
  category: "governance",
  shell: "launcher",

  tabs: [
    { key: "rent", labelKey: "rent", icon: "dollar-sign", default: true },
    { key: "stats", labelKey: "stats", icon: "bar-chart" },
  ],

  stats: [
    { labelKey: "totalPool", valueKey: "totalPoolDisplay", format: "text", variant: "success", icon: "layers" },
    { labelKey: "currentEpoch", valueKey: "currentEpoch", format: "number", icon: "clock" },
    { labelKey: "yourDeposits", valueKey: "userDepositsDisplay", format: "text", variant: "accent", icon: "wallet" },
    { labelKey: "activeBids", valueKey: "bidCount", format: "number", icon: "trending-up" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "totalPool", valueKey: "totalPoolDisplay", format: "text" },
      { labelKey: "currentEpoch", valueKey: "currentEpoch", format: "number" },
      { labelKey: "yourDeposits", valueKey: "userDepositsDisplay", format: "text" },
      { labelKey: "activeBids", valueKey: "bidCount", format: "number" },
    ],
  },

  features: {
    walletRequired: true,
    chainWarning: true,
  },

  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],

  contract: {
    mode: "custom",
  },

  permissions: {
    governance: true,
    payments: true,
  },
};
