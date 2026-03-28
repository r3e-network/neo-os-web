/**
 * AA Session Key Lab Manifest
 *
 * Declarative configuration for the platform-rendered sections.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  // -- Identity --
  name: "AA Session Key Lab",
  description: "Configure SessionKeyVerifier directly on-chain",
  icon: "key",
  category: "console",
  shell: "console",

  // -- Tabs --
  tabs: [
    { key: "session", labelKey: "latestState", icon: "key", default: true },
  ],

  // -- Stats --
  stats: [
    { labelKey: "labelAA", valueKey: "aaCoreDisplay", format: "text", icon: "cpu" },
    { labelKey: "sessionLabel", valueKey: "sessionStatusDisplay", format: "text", icon: "key" },
    { labelKey: "sessionVerifier", valueKey: "sessionVerifierDisplay", format: "text", icon: "shield" },
  ],

  // -- Sidebar --
  sidebar: {
    titleKey: "appName",
    items: [
      { labelKey: "accountIdHash", valueKey: "derivedAccountIdHash", format: "text" },
      { labelKey: "targetContract", valueKey: "normalizedTargetContract", format: "text" },
      { labelKey: "allowedMethod", valueKey: "normalizedAllowedMethod", format: "text" },
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
