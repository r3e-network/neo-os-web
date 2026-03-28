/**
 * Dev Tipping Manifest
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Dev Tipping",
  description: "Tip Neo developers for their contributions",
  icon: "coffee",
  category: "social",
  shell: "launcher",

  tabs: [
    { key: "send", labelKey: "sendTip", icon: "dollar-sign", default: true },
    { key: "stats", labelKey: "stats", icon: "bar-chart" },
  ],

  stats: [
    { labelKey: "developers", valueKey: "developerCount", format: "number", icon: "users" },
    { labelKey: "totalDonated", valueKey: "totalDonatedDisplay", format: "text", variant: "success", icon: "gift" },
    { labelKey: "recentTips", valueKey: "recentTipCount", format: "number", icon: "trending-up" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "developers", valueKey: "developerCount", format: "number" },
      { labelKey: "totalDonated", valueKey: "totalDonatedDisplay", format: "text" },
      { labelKey: "recentTips", valueKey: "recentTipCount", format: "number" },
    ],
  },

  features: {
    fireworks: true,
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
    payments: true,
  },
};
