import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "NeoPay Shared Runtime",
  description: "Compose funding vault and payment stream modules through the shared MiniApp runtime",
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

  contract: { mode: "shared" },

  permissions: { payments: true },
};
