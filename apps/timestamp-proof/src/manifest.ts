/**
 * Timestamp Proof Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the miniapp *except* the play area.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Timestamp Proof",
  description: "Create verifiable timestamp proofs on the blockchain",
  icon: "clock",
  category: "tool",
  shell: "launcher",

  tabs: [
    { key: "proofs", labelKey: "proofs", icon: "clock", default: true },
    { key: "verify", labelKey: "verify", icon: "check-circle" },
  ],

  stats: [
    { labelKey: "totalProofs", valueKey: "totalProofs", format: "number", icon: "clock" },
    { labelKey: "yourProofs", valueKey: "yourProofs", format: "number", icon: "user" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "totalProofs", valueKey: "totalProofs", format: "number" },
      { labelKey: "yourProofs", valueKey: "yourProofs", format: "number" },
      { labelKey: "latestId", valueKey: "latestId", format: "text" },
    ],
  },

  features: { walletRequired: true, chainWarning: true },

  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],

  permissions: { payments: true },

  contract: { mode: "custom" },
};
