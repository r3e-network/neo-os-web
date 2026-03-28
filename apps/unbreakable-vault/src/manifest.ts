/**
 * Unbreakable Vault Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the miniapp *except* the play area.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Unbreakable Vault",
  description: "Create password-protected vaults with GAS bounties",
  icon: "lock",
  category: "game",
  shell: "launcher",

  tabs: [
    { key: "create", labelKey: "create", icon: "lock", default: true },
    { key: "break", labelKey: "break", icon: "key" },
  ],

  stats: [
    { labelKey: "create", valueKey: "myVaultCount", format: "number", icon: "lock" },
    { labelKey: "break", valueKey: "recentVaultCount", format: "number", icon: "key" },
    { labelKey: "sidebarDifficulty", valueKey: "vaultDifficulty", format: "number", icon: "bar-chart" },
    { labelKey: "sidebarAttemptFee", valueKey: "attemptFeeDisplay", format: "text", icon: "zap" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "create", valueKey: "myVaultCount", format: "number" },
      { labelKey: "break", valueKey: "recentVaultCount", format: "number" },
      { labelKey: "sidebarDifficulty", valueKey: "vaultDifficulty", format: "number" },
      { labelKey: "sidebarAttemptFee", valueKey: "attemptFeeDisplay", format: "text" },
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
