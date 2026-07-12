import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Graveyard",
  description: "Create local SHA-256 memory commitments with paid on-chain forgetting records",
  icon: "history",
  category: "tool",
  shell: "launcher",

  tabs: [
    { key: "main", labelKey: "destroy", icon: "trash-2", default: true },
  ],

  stats: [
    { labelKey: "totalDestroyed", valueKey: "totalDestroyed", format: "number", icon: "archive" },
    { labelKey: "gasReclaimed", valueKey: "gasReclaimedDisplay", format: "text", variant: "success", icon: "zap" },
    { labelKey: "history", valueKey: "historyCount", format: "number", icon: "clock" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "totalDestroyed", valueKey: "totalDestroyed", format: "number" },
      { labelKey: "gasReclaimed", valueKey: "gasReclaimedDisplay", format: "text" },
      { labelKey: "history", valueKey: "historyCount", format: "number" },
    ],
  },

  features: {
    fireworks: false,
    walletRequired: true,
    chainWarning: true,
  },

  docs: [
    { titleKey: "title", contentKey: "subtitle", type: "text" },
  ],

  contract: { mode: "custom" },
  permissions: { payments: true },
};
