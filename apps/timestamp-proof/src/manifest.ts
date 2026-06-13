/**
 * Timestamp Proof Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the miniapp *except* the play area.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Timestamp Proof",
  description: "Create SHA-256 timestamp proofs with an optional on-chain anchor",
  icon: "clock",
  category: "tool",
  shell: "launcher",

  tabs: [
    { key: "proofs", labelKey: "proofs", icon: "clock", default: true },
    { key: "verify", labelKey: "verify", icon: "check-circle" },
  ],

  stats: [
    { labelKey: "totalProofs", valueKey: "totalProofs", format: "number", icon: "clock" },
    { labelKey: "anchoredProofs", valueKey: "anchoredProofs", format: "number", icon: "check-circle" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "totalProofs", valueKey: "totalProofs", format: "number" },
      { labelKey: "anchoredProofs", valueKey: "anchoredProofs", format: "number" },
      { labelKey: "latestId", valueKey: "latestId", format: "text" },
    ],
  },

  // Hashing and storage happen entirely in the browser; a wallet is only needed
  // for the optional on-chain anchor, so it is not required by default.
  features: { walletRequired: false, chainWarning: false },

  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],

  // The only chain action is the optional 0-GAS self-transfer anchor (the
  // broadcast cost is normal network fees), so no payments permission is needed.
  contract: { mode: "custom" },
};
