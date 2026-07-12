/**
 * GasBox Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the gasbox miniapp except the play area.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  // -- Identity ---------------------------------------------------------------
  name: "GasBox",
  description: "Play and operate low-stakes on-chain NEO/GAS capsule machines",
  icon: "slot",
  category: "game",
  shell: "launcher",

  // The resource-led capsule counter owns every action. Generic tabs, stats,
  // operation forms and sidebars would duplicate the same state as a survey.
  tabs: [],
  stats: [],
  sidebar: { titleKey: "title", items: [] },
  operations: [],

  // -- Features ---------------------------------------------------------------
  features: {
    fireworks: true,
    walletRequired: false,
    chainWarning: true,
  },

  // -- Docs -------------------------------------------------------------------
  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
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
    payments: true,
  },
};
