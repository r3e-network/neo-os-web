/**
 * Time Capsule Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the miniapp *except* the play area.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Time Capsule",
  description: "Lock messages in time-locked capsules on the blockchain",
  icon: "lock",
  category: "game",
  shell: "launcher",

  tabs: [
    { key: "capsules", labelKey: "tabCapsules", icon: "lock", default: true },
    { key: "create", labelKey: "tabCreate", icon: "plus" },
  ],

  stats: [
    { labelKey: "sidebarTotalCapsules", valueKey: "totalCapsules", format: "number", icon: "box" },
    { labelKey: "sidebarLocked", valueKey: "lockedCount", format: "number", icon: "lock" },
    { labelKey: "sidebarRevealed", valueKey: "revealedCount", format: "number", icon: "unlock" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "sidebarTotalCapsules", valueKey: "totalCapsules", format: "number" },
      { labelKey: "sidebarLocked", valueKey: "lockedCount", format: "number" },
      { labelKey: "sidebarRevealed", valueKey: "revealedCount", format: "number" },
    ],
  },

  features: { walletRequired: true, chainWarning: true },

  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],

  contract: { mode: "custom" },

  permissions: { payments: true },
};
