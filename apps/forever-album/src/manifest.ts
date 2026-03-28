import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Forever Album",
  description: "Store photos permanently on the blockchain",
  icon: "camera",
  category: "social",
  shell: "launcher",

  tabs: [
    { key: "album", labelKey: "albumTab", icon: "camera", default: true },
  ],

  stats: [
    { labelKey: "albumTab", valueKey: "photosCount", format: "number", icon: "image" },
    { labelKey: "sidebarEncrypted", valueKey: "encryptedCount", format: "number", icon: "lock" },
    { labelKey: "sidebarPublic", valueKey: "publicCount", format: "number", icon: "unlock" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "albumTab", valueKey: "photosCount", format: "number" },
      { labelKey: "sidebarEncrypted", valueKey: "encryptedCount", format: "number" },
      { labelKey: "sidebarPublic", valueKey: "publicCount", format: "number" },
    ],
  },

  features: { walletRequired: true, chainWarning: true },

  docs: [
    { titleKey: "title", contentKey: "subtitle", type: "text" },
  ],

  permissions: { payments: true },

  contract: { mode: "custom" },
};
