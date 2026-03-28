/**
 * Gas Sponsor Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the miniapp *except* the play area.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Gas Sponsor",
  description: "Request GAS sponsorship for low-balance wallets",
  icon: "gift",
  category: "tool",
  shell: "launcher",

  tabs: [
    { key: "sponsor", labelKey: "tabSponsor", icon: "gift", default: true },
    { key: "donate", labelKey: "tabDonate", icon: "heart" },
    { key: "send", labelKey: "tabSend", icon: "send" },
    { key: "stats", labelKey: "tabStats", icon: "bar-chart" },
  ],

  stats: [
    { labelKey: "sidebarTankLevel", valueKey: "tankLevelDisplay", format: "text", variant: "accent", icon: "fuel" },
    { labelKey: "gasBalance", valueKey: "gasBalanceDisplay", format: "text", icon: "zap" },
    { labelKey: "sidebarRemainingQuota", valueKey: "remainingQuotaDisplay", format: "text", icon: "target" },
    { labelKey: "sidebarEligible", valueKey: "eligibleDisplay", format: "text", icon: "check" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "sidebarTankLevel", valueKey: "tankLevelDisplay", format: "text" },
      { labelKey: "gasBalance", valueKey: "gasBalanceDisplay", format: "text" },
      { labelKey: "sidebarRemainingQuota", valueKey: "remainingQuotaDisplay", format: "text" },
      { labelKey: "sidebarEligible", valueKey: "eligibleDisplay", format: "text" },
    ],
  },

  features: { walletRequired: true, chainWarning: true },

  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step1", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
    { titleKey: "feature2Name", contentKey: "feature2Desc", type: "features" },
    { titleKey: "feature3Name", contentKey: "feature3Desc", type: "features" },
  ],

  permissions: {
    payments: true,
  },

  contract: { mode: "custom" },
};
