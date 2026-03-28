/**
 * Flamingo Lend Manifest
 *
 * Declarative configuration for the Flamingo Lend miniapp.
 * This app delegates its UI to the shared FlamingoLauncherPage component
 * with the "lend" product key.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Flamingo Lend",
  description: "Lending and borrowing on Flamingo DeFi",
  icon: "credit-card",
  category: "defi",
  shell: "launcher",

  theme: {
    family: "flamingo",
  },

  tabs: [
    { key: "main", labelKey: "title", icon: "credit-card", default: true },
  ],

  features: {
    walletRequired: true,
    chainWarning: true,
  },
};
