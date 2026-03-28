/**
 * AA Market Hub Manifest
 *
 * Declarative configuration for the platform-rendered sections.
 * The miniapp provides only PlayArea.vue (listings + management UI)
 * and useAAMarketHub.ts (domain logic). Everything else is driven here.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  // -- Identity --
  name: "AA Market Hub",
  description: "Create, manage, and settle AA address listings",
  icon: "store",
  category: "console",
  shell: "console",

  // -- Tabs --
  tabs: [
    { key: "market", labelKey: "totalListings", icon: "store", default: true },
  ],

  // -- Stats --
  stats: [
    { labelKey: "totalListings", valueKey: "totalListingsDisplay", format: "number", icon: "box" },
    { labelKey: "activeListings", valueKey: "activeListingsDisplay", format: "number", icon: "fuel" },
    { labelKey: "marketHash", valueKey: "marketHashDisplay", format: "text", icon: "hash" },
    { labelKey: "walletLabel", valueKey: "walletDisplay", format: "text", icon: "wallet" },
  ],

  // -- Sidebar --
  sidebar: {
    titleKey: "appName",
    items: [
      { labelKey: "totalListings", valueKey: "totalListingsDisplay", format: "number" },
      { labelKey: "marketHash", valueKey: "marketHashDisplay", format: "text" },
      { labelKey: "walletLabel", valueKey: "walletDisplay", format: "text" },
      { labelKey: "selectedListingLabel", valueKey: "selectedListingDisplay", format: "text" },
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
    payments: true,
  },
};
