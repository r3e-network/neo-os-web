/**
 * Neo Pay Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the miniapp *except* the play area.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "NeoPay",
  description: "Create and manage streaming payment vaults",
  icon: "credit-card",
  category: "defi",
  shell: "launcher",

  // The designed payment ticket owns creation, claiming, cancellation, and
  // recovery. Generic operation forms would duplicate the same writes and
  // flatten the first screen back into a questionnaire.
  operations: [],

  features: { walletRequired: true, chainWarning: true },

  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step1", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
    { titleKey: "feature2Name", contentKey: "feature2Desc", type: "features" },
    { titleKey: "feature3Name", contentKey: "feature3Desc", type: "features" },
  ],

  contract: { mode: "custom" },

  permissions: { payments: true },
};
