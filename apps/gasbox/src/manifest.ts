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
  description: "Gacha machine marketplace — play, create, and trade capsule machines",
  icon: "slot",
  category: "game",
  shell: "launcher",

  // -- Tabs -------------------------------------------------------------------
  tabs: [
    { key: "market", labelKey: "market", icon: "slot", default: true },
    { key: "discover", labelKey: "discover", icon: "compass" },
    { key: "create", labelKey: "create", icon: "edit" },
    { key: "manage", labelKey: "manage", icon: "settings" },
  ],

  // -- Stats Grid -------------------------------------------------------------
  stats: [
    { labelKey: "machines", valueKey: "machineCount", format: "number", variant: "accent", icon: "box" },
    { labelKey: "playing", valueKey: "isPlayingDisplay", format: "text", icon: "zap" },
    { labelKey: "selected", valueKey: "selectedMachineName", format: "text", icon: "star" },
  ],

  // -- Sidebar ----------------------------------------------------------------
  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "machines", valueKey: "machineCount", format: "number" },
      { labelKey: "playing", valueKey: "isPlayingDisplay", format: "text" },
      { labelKey: "selected", valueKey: "selectedMachineName", format: "text" },
    ],
  },

  // -- Features ---------------------------------------------------------------
  features: {
    fireworks: true,
    walletRequired: true,
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
