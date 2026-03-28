/**
 * Neo Multisig Manifest
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Neo Multisig",
  description: "Create and manage multi-signature transactions",
  icon: "key",
  category: "tool",
  shell: "launcher",

  tabs: [
    { key: "home", labelKey: "tabHome", icon: "home", default: true },
  ],

  stats: [
    { labelKey: "sidebarTotalTxs", valueKey: "totalTxs", format: "number", icon: "hash" },
    { labelKey: "statPending", valueKey: "pendingCount", format: "number", variant: "warning", icon: "clock" },
    { labelKey: "statCompleted", valueKey: "completedCount", format: "number", variant: "success", icon: "check-circle" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "sidebarTotalTxs", valueKey: "totalTxs", format: "number" },
      { labelKey: "statPending", valueKey: "pendingCount", format: "number" },
      { labelKey: "statCompleted", valueKey: "completedCount", format: "number" },
    ],
  },

  features: {
    walletRequired: true,
    chainWarning: true,
  },

  docs: [
    { titleKey: "docTitle", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "docStep1", type: "steps" },
    { titleKey: "docFeature1Name", contentKey: "docFeature1Desc", type: "features" },
  ],

  permissions: { payments: true },

  contract: {
    mode: "custom",
  },
};
