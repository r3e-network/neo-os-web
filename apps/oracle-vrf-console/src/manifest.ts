/**
 * Oracle VRF Console Manifest
 *
 * Declarative configuration for the Oracle VRF randomness console.
 * Triggers Morpheus randomness from a dedicated miniapp.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  // -- Identity ---------------------------------------------------------------
  name: "Oracle VRF Console",
  description: "Trigger Morpheus randomness from a dedicated miniapp",
  icon: "dice",
  category: "oracle",
  shell: "console",

  // -- Tabs -------------------------------------------------------------------
  tabs: [
    { key: "vrf", labelKey: "latestResult", icon: "dice", default: true },
  ],

  // -- Stats ------------------------------------------------------------------
  stats: [
    { labelKey: "network", valueKey: "networkDisplay", format: "text", icon: "globe" },
    { labelKey: "heroVrf", valueKey: "vrfMode", format: "text", icon: "activity" },
    { labelKey: "labelRequest", valueKey: "requestId", format: "text", variant: "accent" },
    { labelKey: "overviewOracle", valueKey: "oracleHash", format: "text", variant: "accent" },
  ],

  // -- Sidebar ----------------------------------------------------------------
  sidebar: {
    titleKey: "appName",
    items: [
      { labelKey: "latestResult", valueKey: "requestId", format: "text" },
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
