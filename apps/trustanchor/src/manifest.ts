/**
 * TrustAnchor Manifest
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "TrustAnchor",
  description: "Zero-fee NEO staking with agent routing",
  icon: "anchor",
  category: "defi",
  shell: "launcher",

  tabs: [
    { key: "overview", labelKey: "tabOverview", icon: "layout", default: true },
    { key: "routing", labelKey: "tabRouting", icon: "grid" },
    { key: "architecture", labelKey: "tabArchitecture", icon: "layers" },
  ],

  stats: [
    { labelKey: "myStake", valueKey: "myStakeDisplay", format: "text", variant: "accent", icon: "lock" },
    { labelKey: "pendingRewards", valueKey: "pendingRewardsDisplay", format: "text", variant: "success", icon: "gift" },
    { labelKey: "agentAccountsLabel", valueKey: "agentCount", format: "number", icon: "grid" },
    { labelKey: "defaultIngressLabel", valueKey: "ingressCount", format: "number", icon: "arrow-down" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "myStake", valueKey: "myStakeDisplay", format: "text" },
      { labelKey: "pendingRewards", valueKey: "pendingRewardsDisplay", format: "text" },
      { labelKey: "agentAccountsLabel", valueKey: "agentCount", format: "number" },
      { labelKey: "defaultIngressLabel", valueKey: "ingressCount", format: "number" },
    ],
  },

  features: {
    walletRequired: true,
    chainWarning: true,
  },

  docs: [
    { titleKey: "title", contentKey: "docsSubtitle", type: "text" },
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
