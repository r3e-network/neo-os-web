/**
 * Automation Copilot Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the miniapp *except* the play area.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Automation Copilot",
  description: "Build and operate oracle-driven automation recipes from live Morpheus data",
  icon: "cpu",
  category: "tool",
  shell: "launcher",

  tabs: [],
  stats: [],

  sidebar: {
    titleKey: "title",
    items: [],
  },

  features: { chainWarning: false },

  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],

  permissions: { datafeed: true, automation: true },

};
