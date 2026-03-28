/**
 * Neo Sign Anything Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the miniapp *except* the play area.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Neo Sign Anything",
  description: "Cryptographically sign any message with your Neo address",
  icon: "pen-tool",
  category: "tool",
  shell: "launcher",

  tabs: [
    { key: "home", labelKey: "home", icon: "pen-tool", default: true },
  ],

  stats: [
    { labelKey: "signCount", valueKey: "signCount", format: "number", icon: "pen-tool" },
    { labelKey: "broadcastCount", valueKey: "broadcastCount", format: "number", icon: "radio" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "signCount", valueKey: "signCount", format: "number" },
      { labelKey: "broadcastCount", valueKey: "broadcastCount", format: "number" },
    ],
  },

  features: { walletRequired: true, chainWarning: true },

  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],

  permissions: {},

  contract: { mode: "custom" },
};
