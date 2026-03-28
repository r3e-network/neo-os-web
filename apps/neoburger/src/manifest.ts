/**
 * NeoBurger Manifest
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "NeoBurger",
  description: "Stake NEO, earn GAS rewards with bNEO",
  icon: "zap",
  category: "defi",
  shell: "launcher",

  tabs: [
    { key: "home", labelKey: "tabHome", icon: "home", default: true },
    { key: "airdrop", labelKey: "tabAirdrop", icon: "rocket" },
    { key: "treasury", labelKey: "tabTreasury", icon: "landmark" },
    { key: "dashboard", labelKey: "tabDashboard", icon: "bar-chart" },
  ],

  stats: [
    { labelKey: "sidebarNeoBalance", valueKey: "neoBalanceDisplay", format: "text", icon: "circle" },
    { labelKey: "sidebarBneoBalance", valueKey: "bNeoBalanceDisplay", format: "text", icon: "circle" },
    { labelKey: "sidebarTotalStaked", valueKey: "totalStakedDisplay", format: "text", variant: "success", icon: "layers" },
    { labelKey: "sidebarApr", valueKey: "aprDisplay", format: "text", variant: "accent", icon: "trending-up" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "sidebarNeoBalance", valueKey: "neoBalanceDisplay", format: "text" },
      { labelKey: "sidebarBneoBalance", valueKey: "bNeoBalanceDisplay", format: "text" },
      { labelKey: "sidebarTotalStaked", valueKey: "totalStakedDisplay", format: "text" },
      { labelKey: "sidebarApr", valueKey: "aprDisplay", format: "text" },
    ],
  },

  features: {
    fireworks: true,
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
    payments: true,
  },
};
