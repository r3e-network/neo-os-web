/**
 * Dev Tipping Manifest
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Developer Tipping",
  description: "Choose a registered Neo builder, send an exact GAS tip, and keep a recoverable on-chain receipt",
  icon: "heart",
  category: "social",
  shell: "launcher",

  tabs: [],

  stats: [],

  sidebar: {
    titleKey: "title",
    items: [],
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
