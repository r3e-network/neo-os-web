/**
 * Oracle HTTP Console Manifest
 *
 * Declarative configuration for the Oracle HTTP query console.
 * Queries allowlisted HTTP sources through Morpheus Oracle.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  // -- Identity ---------------------------------------------------------------
  name: "Oracle HTTP Console",
  description: "Query allowlisted HTTP sources through Morpheus Oracle",
  icon: "globe",
  category: "oracle",
  shell: "console",

  // -- Tabs -------------------------------------------------------------------
  tabs: [
    { key: "oracle", labelKey: "latestResponse", icon: "globe", default: true },
  ],

  // -- Stats ------------------------------------------------------------------
  stats: [
    { labelKey: "network", valueKey: "networkDisplay", format: "text", icon: "globe" },
    { labelKey: "heroMode", valueKey: "methodDisplay", format: "text", icon: "activity" },
    { labelKey: "labelStatus", valueKey: "statusCode", format: "text", variant: "accent" },
    { labelKey: "overviewOracle", valueKey: "oracleHash", format: "text", variant: "accent" },
  ],

  // -- Sidebar ----------------------------------------------------------------
  sidebar: {
    titleKey: "appName",
    items: [
      { labelKey: "method", valueKey: "methodDisplay", format: "text" },
      { labelKey: "latestResponse", valueKey: "statusCode", format: "text" },
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
