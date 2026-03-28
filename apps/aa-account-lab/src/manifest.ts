/**
 * AA Account Lab Manifest
 *
 * Declarative configuration for the platform-rendered sections.
 * The miniapp provides only PlayArea.vue (inspect + register forms)
 * and useAAAccountLab.ts (domain logic). Everything else is driven here.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  // -- Identity --
  name: "AA Account Lab",
  description: "Register and inspect Neo AA accounts",
  icon: "badge",
  category: "console",
  shell: "console",

  // -- Tabs --
  tabs: [
    { key: "register", labelKey: "register", icon: "badge", default: true },
  ],

  // -- Stats --
  stats: [
    { labelKey: "aaCore", valueKey: "aaCoreDisplay", format: "text", icon: "cpu" },
    { labelKey: "defaultVerifier", valueKey: "defaultVerifierDisplay", format: "text", icon: "shield" },
    { labelKey: "network", valueKey: "networkDisplay", format: "text", icon: "globe" },
  ],

  // -- Sidebar --
  sidebar: {
    titleKey: "appName",
    items: [
      { labelKey: "currentVerifier", valueKey: "currentVerifier", format: "text" },
      { labelKey: "currentHook", valueKey: "currentHook", format: "text" },
      { labelKey: "currentBackupOwner", valueKey: "currentBackupOwner", format: "text" },
    ],
  },

  // -- Features --
  features: {
    walletRequired: false,
    chainWarning: true,
  },

  // -- Docs --
  docs: [
    { titleKey: "appName", contentKey: "docsSubtitle", type: "text" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
    { titleKey: "feature2Name", contentKey: "feature2Desc", type: "features" },
    { titleKey: "feature3Name", contentKey: "feature3Desc", type: "features" },
  ],

  // -- Permissions --
  permissions: {
    aa: true,
  },
};
