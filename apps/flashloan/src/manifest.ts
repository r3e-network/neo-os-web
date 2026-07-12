/**
 * Flash Loan Manifest
 *
 * The designed execution desk owns the primary hierarchy. The host manifest
 * intentionally avoids duplicate tabs, stat grids, and operation forms.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Flash Loan",
  description: "Atomic flash loans on Neo N3 — borrow and repay in a single transaction",
  icon: "zap",
  category: "defi",
  shell: "launcher",
  theme: { family: "finance", accentColor: "#0f766e", density: "comfortable" },

  features: {
    walletRequired: true,
    chainWarning: true,
  },

  docs: [
    { titleKey: "docTitle", contentKey: "docDescription", type: "text" },
    { titleKey: "howToUse", contentKey: "deployCallbackDesc", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
    { titleKey: "feature2Name", contentKey: "feature2Desc", type: "features" },
  ],

  contract: {
    mode: "custom",
  },

  permissions: {
    payments: true,
  },
};
