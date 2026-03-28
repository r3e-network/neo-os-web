/**
 * Neo Pay Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the miniapp *except* the play area.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Neo Pay",
  description: "Create and manage streaming payment vaults",
  icon: "credit-card",
  category: "defi",
  shell: "launcher",

  tabs: [
    { key: "create", labelKey: "createTab", icon: "plus", default: true },
  ],

  stats: [
    { labelKey: "myCreated", valueKey: "createdStreamCount", format: "number", icon: "upload" },
    { labelKey: "beneficiaryVaults", valueKey: "beneficiaryStreamCount", format: "number", icon: "download" },
    { labelKey: "statusActive", valueKey: "activeCount", format: "number", variant: "accent", icon: "play" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "myCreated", valueKey: "createdStreamCount", format: "number" },
      { labelKey: "beneficiaryVaults", valueKey: "beneficiaryStreamCount", format: "number" },
      { labelKey: "statusActive", valueKey: "activeCount", format: "number" },
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

  contract: { mode: "custom" },

  permissions: { payments: true },
};
