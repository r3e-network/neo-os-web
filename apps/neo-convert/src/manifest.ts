/**
 * Neo N3 Converter Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the miniapp *except* the play area.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Neo N3 Converter",
  description: "Generate accounts and convert keys client-side",
  icon: "repeat",
  category: "tool",
  shell: "launcher",

  tabs: [
    { key: "generate", labelKey: "tabGenerate", icon: "wallet", default: true },
    { key: "convert", labelKey: "tabConvert", icon: "repeat" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "sidebarActiveTab", valueKey: "activeTab", format: "text" },
      { labelKey: "sidebarMode", valueKey: "deviceMode", format: "text" },
    ],
  },

  features: { chainWarning: false },

  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],
};
