/**
 * Neo X Bridge Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the miniapp *except* the play area.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Neo X Bridge",
  description: "Bridge assets between Neo N3 and Neo X",
  icon: "git-branch",
  category: "tool",
  shell: "launcher",

  tabs: [
    { key: "bridge", labelKey: "tabBridge", icon: "git-branch", default: true },
    { key: "networks", labelKey: "tabNetworks", icon: "globe" },
  ],

  stats: [
    { labelKey: "supportedRoute", valueKey: "supportedRoute", format: "text", icon: "map" },
    { labelKey: "supportedAsset", valueKey: "supportedAsset", format: "text", icon: "dollar-sign" },
    { labelKey: "selectedNetwork", valueKey: "selectedNetwork", format: "text", icon: "globe" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "supportedRoute", valueKey: "supportedRoute", format: "text" },
      { labelKey: "supportedAsset", valueKey: "supportedAsset", format: "text" },
      { labelKey: "selectedNetwork", valueKey: "selectedNetwork", format: "text" },
      { labelKey: "chainId", valueKey: "chainId", format: "text" },
    ],
  },

  features: { chainWarning: false },

  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],

  permissions: { payments: true },
};
