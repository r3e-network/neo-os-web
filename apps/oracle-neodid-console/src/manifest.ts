/**
 * Oracle NeoDID Console Manifest
 *
 * Declarative configuration for the NeoDID resolution console.
 * Resolves NeoDID documents and inspects providers.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  // -- Identity ---------------------------------------------------------------
  name: "Oracle NeoDID Console",
  description: "Resolve NeoDID documents and inspect providers",
  icon: "badge",
  category: "oracle",
  shell: "console",

  // -- Tabs -------------------------------------------------------------------
  tabs: [
    { key: "neodid", labelKey: "latestDocument", icon: "badge", default: true },
  ],

  // -- Stats ------------------------------------------------------------------
  stats: [
    { labelKey: "network", valueKey: "networkDisplay", format: "text", icon: "globe" },
    { labelKey: "format", valueKey: "formatDisplay", format: "text", icon: "file-text" },
    { labelKey: "providersLabel", valueKey: "providerCount", format: "number", icon: "users" },
    { labelKey: "publicApi", valueKey: "publicApiUrl", format: "text", variant: "accent" },
  ],

  // -- Sidebar ----------------------------------------------------------------
  sidebar: {
    titleKey: "appName",
    items: [
      { labelKey: "did", valueKey: "did", format: "text" },
      { labelKey: "format", valueKey: "formatDisplay", format: "text" },
      { labelKey: "providersLabel", valueKey: "providerCount", format: "number" },
    ],
  },

  // -- Features ---------------------------------------------------------------
  features: {
    walletRequired: false,
  },

  // -- Docs -------------------------------------------------------------------
  docs: [
    { titleKey: "appName", contentKey: "docsSubtitle", type: "text" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
    { titleKey: "feature2Name", contentKey: "feature2Desc", type: "features" },
    { titleKey: "feature3Name", contentKey: "feature3Desc", type: "features" },
  ],

  // -- Contract ---------------------------------------------------------------
  contract: {
    mode: "custom",
  },

  // -- Permissions ------------------------------------------------------------
  permissions: {
    compute: true,
  },
};
