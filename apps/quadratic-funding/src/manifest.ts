/**
 * Quadratic Funding Manifest
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Quadratic Funding",
  description: "Public-goods rounds with operator-reviewed aggregate matching estimates",
  icon: "heart",
  category: "governance",
  shell: "launcher",

  tabs: [
    { key: "contribute", labelKey: "tabContribute", icon: "heart", default: true },
    { key: "projects", labelKey: "tabProjects", icon: "folder" },
    { key: "rounds", labelKey: "tabRounds", icon: "target" },
  ],

  stats: [
    { labelKey: "tabRounds", valueKey: "roundCount", format: "number", icon: "target" },
    { labelKey: "tabProjects", valueKey: "projectCount", format: "number", icon: "folder" },
    { labelKey: "sidebarSelectedRound", valueKey: "selectedRoundDisplay", format: "text", icon: "check-circle" },
    { labelKey: "sidebarMatchingPool", valueKey: "matchingPoolDisplay", format: "text", variant: "success", icon: "gift" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "tabRounds", valueKey: "roundCount", format: "number" },
      { labelKey: "tabProjects", valueKey: "projectCount", format: "number" },
      { labelKey: "sidebarSelectedRound", valueKey: "selectedRoundDisplay", format: "text" },
      { labelKey: "sidebarMatchingPool", valueKey: "matchingPoolDisplay", format: "text" },
    ],
  },

  features: {
    // Round and project discovery is public. Ask for a wallet only when the
    // user starts a transaction, so browse-only deployments remain useful.
    walletRequired: false,
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
    governance: true,
  },
};
