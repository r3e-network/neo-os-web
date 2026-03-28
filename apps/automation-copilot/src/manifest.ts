/**
 * Automation Copilot Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the miniapp *except* the play area.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Automation Copilot",
  description: "Build and preview oracle-driven automation recipes",
  icon: "cpu",
  category: "console",
  shell: "console",

  tabs: [
    { key: "automation", labelKey: "latestResult", icon: "cpu", default: true },
  ],

  stats: [
    { labelKey: "asset", valueKey: "asset", format: "text", icon: "dollar-sign" },
    { labelKey: "currentPrice", valueKey: "currentPrice", format: "text", icon: "trending-up" },
    { labelKey: "targetPrice", valueKey: "targetPrice", format: "text", icon: "target" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "asset", valueKey: "asset", format: "text" },
      { labelKey: "currentPrice", valueKey: "currentPrice", format: "text" },
      { labelKey: "targetPrice", valueKey: "targetPrice", format: "text" },
      { labelKey: "schedule", valueKey: "schedule", format: "text" },
    ],
  },

  features: { chainWarning: false },

  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],

  permissions: { datafeed: true, automation: true },

  contract: { mode: "custom" },
};
