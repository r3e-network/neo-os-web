/**
 * Flamingo Earn Manifest
 *
 * Declarative configuration for the Flamingo Earn miniapp.
 * This app delegates its UI to the shared FlamingoLauncherPage component
 * with the "earn" product key.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Flamingo Earn",
  description: "Earn yield on Flamingo DeFi",
  icon: "trending-up",
  category: "defi",
  shell: "launcher",

  theme: {
    family: "flamingo",
  },

  tabs: [
    { key: "main", labelKey: "title", icon: "trending-up", default: true },
  ],

  features: {
    walletRequired: true,
    chainWarning: true,
  },
};
