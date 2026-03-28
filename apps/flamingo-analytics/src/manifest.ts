/**
 * Flamingo Analytics Manifest
 *
 * Declarative configuration for the Flamingo Analytics miniapp.
 * This app delegates its UI to the shared FlamingoLauncherPage component
 * with the "analytics" product key.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Flamingo Analytics",
  description: "Flamingo DeFi analytics dashboard",
  icon: "bar-chart-2",
  category: "defi",
  shell: "launcher",

  theme: {
    family: "flamingo",
  },

  tabs: [
    { key: "main", labelKey: "title", icon: "bar-chart-2", default: true },
  ],

  features: {
    walletRequired: false,
    chainWarning: true,
  },
};
