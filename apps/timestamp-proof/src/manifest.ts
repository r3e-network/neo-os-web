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

  // Hashing and storage happen entirely in the browser; a wallet is only needed
  // for the optional on-chain anchor, so it is not required by default.
  features: { walletRequired: false, chainWarning: false },
  permissions: {
    "invoke:platform-social": true,
  },

  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],
};
