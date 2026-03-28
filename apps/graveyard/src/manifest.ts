import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Graveyard",
  description: "Destroy digital assets and reclaim GAS",
  icon: "skull",
  category: "tool",
  shell: "launcher",

  tabs: [
    { key: "main", labelKey: "destroy", icon: "trash-2", default: true },
  ],

  stats: [
    { labelKey: "totalDestroyed", valueKey: "totalDestroyed", format: "number", icon: "skull" },
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
    fireworks: true,
    walletRequired: true,
    chainWarning: true,
  },

  docs: [
    { titleKey: "title", contentKey: "subtitle", type: "text" },
  ],

  contract: { mode: "custom" },
  permissions: { payments: true },
};
