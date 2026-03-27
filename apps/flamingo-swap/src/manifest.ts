/**
 * Flamingo Swap Manifest
 *
 * Declarative configuration for the Flamingo Swap miniapp.
 * This app delegates its UI to the shared FlamingoLauncherPage component
 * with the "swap" product key.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Flamingo Swap",
  description: "Token swaps on Flamingo DEX",
  icon: "repeat",
  category: "defi",
  shell: "launcher",

  theme: {
    family: "flamingo",
  },

  tabs: [
    { key: "main", labelKey: "title", icon: "repeat", default: true },
  ],

  stats: [
    { labelKey: "statNetwork", valueKey: "networkLabel", format: "text", icon: "globe" },
    { labelKey: "statSwapCount", valueKey: "swapCount", format: "number", icon: "repeat" },
    { labelKey: "statTotalVolume", valueKey: "totalVolume", format: "number", icon: "bar-chart-2" },
    { labelKey: "statActivePool", valueKey: "activePool", format: "text", icon: "droplet" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "statNetwork", valueKey: "networkLabel", format: "text" },
      { labelKey: "statSwapCount", valueKey: "swapCount", format: "number" },
      { labelKey: "statTotalVolume", valueKey: "totalVolume", format: "number" },
      { labelKey: "statActivePool", valueKey: "activePool", format: "text" },
    ],
  },

  features: {
    walletRequired: true,
    chainWarning: true,
  },

  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docHowToSwap", contentKey: "docHowToSwapContent", type: "steps" },
    { titleKey: "docLiquidity", contentKey: "docLiquidityContent", type: "features" },
  ],

  permissions: { payments: true },

  contract: { mode: "custom" },
};
