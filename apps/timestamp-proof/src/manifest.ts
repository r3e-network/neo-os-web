/**
 * Timestamp Proof Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the miniapp *except* the play area.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Timestamp Proof",
  description: "Create and verify device-local SHA-256 timestamp proofs",
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

  // Device-local journal: hashing and storage happen entirely in the browser,
  // so no wallet connection is required and there is no chain to warn about.
  features: { walletRequired: false, chainWarning: false },

  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],

  // No funds ever move — proofs are stored locally and stamped `local:<hash>`,
  // so the payments permission is intentionally omitted.
  contract: { mode: "custom" },
};
