/**
 * Wallet Health Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the miniapp *except* the play area.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Wallet Health",
  description: "Analyze wallet security and get improvement recommendations",
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
    { labelKey: "statNeo", valueKey: "neoDisplay", format: "text", icon: "dollar-sign" },
    { labelKey: "statGas", valueKey: "gasDisplay", format: "text", icon: "zap" },
    { labelKey: "statScore", valueKey: "safetyScore", format: "text", variant: "accent", icon: "shield" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "statConnection", valueKey: "connectionStatus", format: "text" },
      { labelKey: "statNetwork", valueKey: "networkLabel", format: "text" },
      { labelKey: "statNeo", valueKey: "neoDisplay", format: "text" },
      { labelKey: "statGas", valueKey: "gasDisplay", format: "text" },
      { labelKey: "statScore", valueKey: "safetyScore", format: "text" },
    ],
  },

  features: { walletRequired: true, chainWarning: true },

  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],

  permissions: {},

  contract: { mode: "custom" },
};
