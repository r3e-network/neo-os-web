/**
 * Gov Merc Manifest
 *
 * Declarative configuration for the governance mercenary pool miniapp.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Gov Merc",
  description: "Stake NEO to earn the GAS auction yield; bid GAS to win the epoch's influence title",
  icon: "shield",
  category: "governance",
  shell: "launcher",
  theme: { family: "finance", accentColor: "#0b7d5d", density: "comfortable" },

  // The resource-led market desk owns the live round, balances and recovery.
  // Empty shell chrome prevents a second generic dashboard/form from repeating it.
  tabs: [],
  stats: [],
  sidebar: { titleKey: "title", items: [] },
  operations: [],

  features: {
    walletRequired: true,
    chainWarning: true,
  },

  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],

  contract: {
    mode: "custom",
  },

  permissions: {
    governance: true,
    payments: true,
  },
};
