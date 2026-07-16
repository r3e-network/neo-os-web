/**
 * AA Relay Console Manifest
 *
 * Declarative configuration for the platform-rendered sections.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  // -- Identity --
  name: "AA Relay Console",
  description: "Prepare and recover verifiable AA relay jobs",
  icon: "signal",
  category: "console",
  shell: "console",

  // -- Tabs --
  tabs: [
    { key: "relay", labelKey: "latestRelay", icon: "signal", default: true },
  ],

  // -- Stats --
  stats: [
    { labelKey: "labelAA", valueKey: "aaCoreDisplay", format: "text", icon: "cpu" },
    { labelKey: "network", valueKey: "networkDisplay", format: "text", icon: "globe" },
    { labelKey: "runtimeLabel", valueKey: "runtimeMode", format: "text", icon: "shield" },
    { labelKey: "chainStateLabel", valueKey: "chainStatus", format: "text", icon: "signal" },
  ],

  // -- Sidebar --
  // `reviewJobId` and `txidDisplay` rested at "", so the chrome rendered two
  // blank tiles before a job was prepared or relayed. They are `undefined`
  // until they exist, and name that state here instead. `reviewReadiness` holds
  // a real "draft" value from the first tick and is never unset.
  sidebar: {
    titleKey: "appName",
    items: [
      { labelKey: "jobId", valueKey: "reviewJobId", format: "text", pendingKey: "jobIdPending" },
      { labelKey: "reviewStateLabel", valueKey: "reviewReadiness", format: "text" },
      { labelKey: "txidLabel", valueKey: "txidDisplay", format: "text", pendingKey: "txidPending" },
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
