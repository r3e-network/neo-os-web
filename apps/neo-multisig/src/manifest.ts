/**
 * Neo Multisig Manifest
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Neo Multisig",
  description: "Create and operate threshold-approved Neo contract-custody vaults",
  icon: "key",
  category: "tool",
  shell: "launcher",

  features: {
    walletRequired: true,
    chainWarning: true,
  },

  docs: [
    { titleKey: "docTitle", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "docStep1", type: "steps" },
    { titleKey: "docFeature1Name", contentKey: "docFeature1Desc", type: "features" },
  ],

  permissions: { payments: true },

  contract: {
    mode: "custom",
  },
};
