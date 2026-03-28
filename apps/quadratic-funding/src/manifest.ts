/**
 * Quadratic Funding Manifest
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Quadratic Funding",
  description: "Community-driven quadratic funding for public goods",
  icon: "heart",
  category: "governance",
  shell: "launcher",

  tabs: [
    { key: "rounds", labelKey: "tabRounds", icon: "target", default: true },
    { key: "projects", labelKey: "tabProjects", icon: "folder" },
    { key: "contribute", labelKey: "tabContribute", icon: "heart" },
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
    governance: true,
  },
};
