/**
 * Oracle Compute Lab Manifest
 *
 * Declarative configuration for the Oracle compute console.
 * Executes registered Morpheus compute scripts through the shared edge route.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  // -- Identity ---------------------------------------------------------------
  name: "Oracle Compute Lab",
  description: "Run registered Morpheus compute jobs",
  icon: "cpu",
  category: "oracle",
  shell: "console",

  // -- Tabs -------------------------------------------------------------------
  tabs: [
    { key: "compute", labelKey: "latestJob", icon: "cpu", default: true },
  ],

  // -- Stats ------------------------------------------------------------------
  stats: [
    { labelKey: "heroCompute", valueKey: "computeType", format: "text", icon: "cpu" },
    { labelKey: "labelStatus", valueKey: "jobStatus", format: "text", icon: "activity" },
    { labelKey: "overviewComputeUrl", valueKey: "computeUrl", format: "text", variant: "accent" },
    { labelKey: "overviewOracle", valueKey: "oracleHash", format: "text", variant: "accent" },
  ],

  // -- Sidebar ----------------------------------------------------------------
  sidebar: {
    titleKey: "appName",
    items: [
      { labelKey: "latestJob", valueKey: "jobStatus", format: "text" },
      { labelKey: "scriptName", valueKey: "scriptName", format: "text" },
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
