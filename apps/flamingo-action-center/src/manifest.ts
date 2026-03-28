/**
 * Flamingo Action Center Manifest
 *
 * Declarative configuration for the Flamingo Action Center miniapp.
 * This app delegates its UI to the shared FlamingoLauncherPage component
 * with the "actionCenter" product key.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Flamingo Action Center",
  description: "Flamingo DeFi action center for managing positions",
  icon: "activity",
  category: "defi",
  shell: "launcher",

  theme: {
    family: "flamingo",
  },

  tabs: [
    { key: "main", labelKey: "title", icon: "activity", default: true },
  ],

  features: {
    walletRequired: true,
    chainWarning: true,
  },
};
