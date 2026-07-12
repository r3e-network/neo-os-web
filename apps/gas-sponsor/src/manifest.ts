/**
 * Gas Sponsor Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the miniapp *except* the play area.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Gas Sponsor",
  description: "Operate transparent on-chain GAS sponsorship pools",
  icon: "fuel",
  category: "defi",
  shell: "market",

  tabs: [],
  stats: [],
  sidebar: { titleKey: "title", items: [] },

  features: { walletRequired: false, chainWarning: true },

  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step1", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
    { titleKey: "feature2Name", contentKey: "feature2Desc", type: "features" },
    { titleKey: "feature3Name", contentKey: "feature3Desc", type: "features" },
  ],

  permissions: {
    payments: true,
  },

  contract: { mode: "custom" },
};
