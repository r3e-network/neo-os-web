/**
 * Oracle Seal Console Manifest
 *
 * Declarative configuration for the Oracle confidential sealing console.
 * Encrypts private Oracle / compute inputs locally.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  // -- Identity ---------------------------------------------------------------
  name: "Oracle Seal Console",
  description: "Encrypt private Oracle / compute inputs locally",
  icon: "lock",
  category: "oracle",
  shell: "console",

  // -- Tabs -------------------------------------------------------------------
  tabs: [
    { key: "seal", labelKey: "outputTitle", icon: "lock", default: true },
  ],

  // -- Stats ------------------------------------------------------------------
  stats: [
    { labelKey: "heroNetwork", valueKey: "networkDisplay", format: "text", icon: "globe" },
    { labelKey: "heroField", valueKey: "fieldDisplay", format: "text", icon: "puzzle" },
    { labelKey: "heroMode", valueKey: "modeDisplay", format: "text", icon: "package" },
    { labelKey: "algorithm", valueKey: "algorithmDisplay", format: "text", variant: "accent" },
  ],

  // -- Sidebar ----------------------------------------------------------------
  sidebar: {
    titleKey: "appName",
    items: [
      { labelKey: "modeLabel", valueKey: "modeDisplay", format: "text" },
      { labelKey: "fieldTypeTitle", valueKey: "fieldDisplay", format: "text" },
      { labelKey: "algorithm", valueKey: "algorithmDisplay", format: "text" },
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
