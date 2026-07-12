/**
 * Unbreakable Vault Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the miniapp *except* the play area.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Unbreakable Vault",
  description: "Inspect and manage hash-locked GAS bounty vaults",
  icon: "lock",
  category: "defi",
  shell: "launcher",
  theme: { family: "finance", accentColor: "#0f766e", density: "comfortable" },

  features: { walletRequired: true, chainWarning: true },

  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "howItWorks", contentKey: "stepsCombined", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],

  contract: { mode: "custom" },

  permissions: { payments: true },
};
