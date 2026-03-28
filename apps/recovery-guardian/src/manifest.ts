/**
 * Recovery Guardian Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the miniapp *except* the play area.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Recovery Guardian",
  description: "Query and manage AA account recovery state",
  icon: "shield",
  category: "console",
  shell: "console",

  tabs: [
    { key: "guardian", labelKey: "latestState", icon: "shield", default: true },
  ],

  stats: [
    { labelKey: "accountId", valueKey: "accountId", format: "text", icon: "user" },
    { labelKey: "currentVerifier", valueKey: "verifierHash", format: "text", icon: "shield" },
    { labelKey: "threshold", valueKey: "threshold", format: "text", icon: "sliders" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "accountId", valueKey: "accountId", format: "text" },
      { labelKey: "currentVerifier", valueKey: "verifierHash", format: "text" },
      { labelKey: "threshold", valueKey: "threshold", format: "text" },
      { labelKey: "timelockLabel", valueKey: "timelock", format: "text" },
    ],
  },

  features: { chainWarning: false },

  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],

  permissions: { aa: true },

  contract: { mode: "custom" },
};
