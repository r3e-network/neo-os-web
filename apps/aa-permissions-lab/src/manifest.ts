import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "AA Permissions Lab",
  description: "Update AA verifier and hook bindings",
  icon: "puzzle",
  category: "console",
  shell: "console",

  tabs: [
    { key: "permissions", labelKey: "updateVerifier", icon: "puzzle", default: true },
  ],

  stats: [
    { labelKey: "currentVerifier", valueKey: "currentVerifier", format: "text", icon: "shield" },
    { labelKey: "currentHook", valueKey: "currentHook", format: "text", icon: "link" },
    { labelKey: "currentBackupOwner", valueKey: "currentBackupOwner", format: "text", icon: "user" },
  ],

  sidebar: {
    titleKey: "appName",
    items: [
      { labelKey: "currentVerifier", valueKey: "currentVerifier", format: "text" },
      { labelKey: "currentHook", valueKey: "currentHook", format: "text" },
      { labelKey: "currentBackupOwner", valueKey: "currentBackupOwner", format: "text" },
    ],
  },

  features: {
    walletRequired: false,
    chainWarning: true,
  },

  docs: [
    { titleKey: "appName", contentKey: "docsSubtitle", type: "text" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
    { titleKey: "feature2Name", contentKey: "feature2Desc", type: "features" },
    { titleKey: "feature3Name", contentKey: "feature3Desc", type: "features" },
  ],

  permissions: {
    aa: true,
  },
};
