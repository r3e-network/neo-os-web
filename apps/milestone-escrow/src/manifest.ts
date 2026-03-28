/**
 * Milestone Escrow Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the miniapp *except* the play area.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Milestone Escrow",
  description: "Create and manage milestone-based escrow payments",
  icon: "flag",
  category: "defi",
  shell: "launcher",

  tabs: [
    { key: "create", labelKey: "createTab", icon: "plus", default: true },
  ],

  stats: [
    { labelKey: "createTab", valueKey: "creatorEscrowCount", format: "number", icon: "upload" },
    { labelKey: "escrowsTab", valueKey: "beneficiaryEscrowCount", format: "number", icon: "download" },
    { labelKey: "statusActive", valueKey: "activeCount", format: "number", variant: "accent", icon: "play" },
    { labelKey: "statusCompleted", valueKey: "completedCount", format: "number", variant: "success", icon: "check" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "createTab", valueKey: "creatorEscrowCount", format: "number" },
      { labelKey: "escrowsTab", valueKey: "beneficiaryEscrowCount", format: "number" },
      { labelKey: "statusActive", valueKey: "activeCount", format: "number" },
      { labelKey: "statusCompleted", valueKey: "completedCount", format: "number" },
    ],
  },

  features: { walletRequired: true, chainWarning: true },

  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],

  contract: { mode: "custom" },

  permissions: { payments: true },
};
