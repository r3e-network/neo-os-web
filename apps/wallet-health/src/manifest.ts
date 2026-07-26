/**
 * Wallet Health Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the miniapp *except* the play area.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Wallet Health",
  description: "Read NEO and GAS balances, complete a device-local self-check, and export an evidence-scoped wallet checkup without sending a transaction.",
  icon: "shield",
  category: "tool",
  shell: "launcher",

  tabs: [
    { key: "health", labelKey: "tabHealth", icon: "shield", default: true },
    { key: "checklist", labelKey: "tabChecklist", icon: "check-circle" },
  ],

  stats: [
    { labelKey: "statConnection", valueKey: "connectionStatus", format: "text", icon: "wifi" },
    { labelKey: "statNetwork", valueKey: "networkLabel", format: "text", icon: "globe" },
    { labelKey: "statScore", valueKey: "safetyScore", format: "text", variant: "accent", icon: "shield" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "statConnection", valueKey: "connectionStatus", format: "text" },
      { labelKey: "statNetwork", valueKey: "networkLabel", format: "text" },
      { labelKey: "statScore", valueKey: "safetyScore", format: "text" },
    ],
  },

  features: { walletRequired: false, chainWarning: false },

  docs: [
    { titleKey: "title", contentKey: "docsSubtitle", type: "text" },
    { titleKey: "docsDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],

  permissions: {
    payments: false,
    randomness: false,
    compute: false,
    oracle: false,
  },

};
