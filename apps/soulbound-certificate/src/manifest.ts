import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Soulbound Certificate",
  description: "Issue and manage soulbound NFT certificates",
  icon: "award",
  category: "social",
  shell: "launcher",

  tabs: [
    { key: "templates", labelKey: "templatesTab", icon: "scroll", default: true },
    { key: "certificates", labelKey: "certificatesTab", icon: "award" },
    { key: "verify", labelKey: "verifyTab", icon: "check-circle" },
  ],

  stats: [
    { labelKey: "templatesTab", valueKey: "templatesCount", format: "number", icon: "scroll" },
    { labelKey: "certificatesTab", valueKey: "certificatesCount", format: "number", icon: "award" },
    { labelKey: "sidebarActive", valueKey: "activeTemplatesCount", format: "number", variant: "success", icon: "check-circle" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "templatesTab", valueKey: "templatesCount", format: "number" },
      { labelKey: "certificatesTab", valueKey: "certificatesCount", format: "number" },
      { labelKey: "sidebarActive", valueKey: "activeTemplatesCount", format: "number" },
    ],
  },

  features: { walletRequired: true, chainWarning: true },

  docs: [
    { titleKey: "title", contentKey: "subtitle", type: "text" },
  ],

  permissions: { payments: true },

  contract: { mode: "custom" },
};
