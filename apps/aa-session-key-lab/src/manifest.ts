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
  category: "tool",
  shell: "console",
  theme: {
    family: "default",
    accentColor: "#13896b",
    density: "comfortable",
  },

  // -- Tabs --
  tabs: [],

  // -- Stats --
  stats: [],

  // -- Sidebar --
  sidebar: {
    items: [],
  },

  // -- Features --
  features: {
    walletRequired: false,
    chainWarning: true,
    activityFeed: false,
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
