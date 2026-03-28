import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Breakup Contract",
  description: "On-chain relationship contracts with stakes",
  icon: "broken_heart",
  category: "social",
  shell: "launcher",

  tabs: [
    { key: "create", labelKey: "tabCreate", icon: "broken_heart", default: true },
  ],

  stats: [
    { labelKey: "active", valueKey: "activeCount", format: "number", variant: "success", icon: "heart" },
    { labelKey: "pending", valueKey: "pendingCount", format: "number", variant: "warning", icon: "clock" },
    { labelKey: "total", valueKey: "contractCount", format: "number", icon: "file-text" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "tabContracts", valueKey: "contractCount", format: "number" },
      { labelKey: "active", valueKey: "activeCount", format: "number" },
      { labelKey: "broken", valueKey: "brokenCount", format: "number" },
    ],
  },

  features: { walletRequired: true, chainWarning: true },

  docs: [
    { titleKey: "title", contentKey: "subtitle", type: "text" },
  ],

  contract: { mode: "custom" },
  permissions: { payments: true },
};
