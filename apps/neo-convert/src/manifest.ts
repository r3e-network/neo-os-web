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

  // The PlayStage is one unified workbench. Decorative Generate/Convert tabs
  // would imply navigation that does not exist, so mode is shown as state
  // rather than a fake tab control.
  tabs: [],

  sidebar: {
    titleKey: "appTitle",
    items: [
      { labelKey: "sidebarWorkspace", valueKey: "activeTab", format: "text" },
      { labelKey: "sidebarMode", valueKey: "deviceMode", format: "text" },
    ],
  },

  features: { chainWarning: false },

  docs: [
    { titleKey: "docTitle", contentKey: "docDescription", type: "text" },
    { titleKey: "docStep1", contentKey: "docStep2", type: "steps" },
    { titleKey: "docFeature1Name", contentKey: "docFeature1Desc", type: "features" },
  ],
};
