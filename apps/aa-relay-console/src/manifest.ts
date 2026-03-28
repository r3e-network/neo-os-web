/**
 * AA Relay Console Manifest
 *
 * Declarative configuration for the platform-rendered sections.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  // -- Identity --
  name: "AA Relay Console",
  description: "Inspect AA relay and paymaster behavior",
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
    { labelKey: "relayLabel", valueKey: "relayUrlDisplay", format: "text", icon: "signal" },
    { labelKey: "network", valueKey: "networkDisplay", format: "text", icon: "globe" },
    { labelKey: "paymasterLabel", valueKey: "paymasterDisplay", format: "text", icon: "wallet" },
  ],

  // -- Sidebar --
  sidebar: {
    titleKey: "appName",
    items: [
      { labelKey: "aaAddress", valueKey: "aaAddressDisplay", format: "text" },
      { labelKey: "latestRelay", valueKey: "relayResponse", format: "text" },
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
