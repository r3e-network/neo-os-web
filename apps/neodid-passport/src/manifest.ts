/**
 * NeoDID Passport Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the miniapp *except* the play area.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "NeoDID Passport",
  description: "Resolve and manage decentralized identity documents",
  icon: "user",
  category: "console",
  shell: "console",

  tabs: [
    { key: "passport", labelKey: "latestResult", icon: "user", default: true },
  ],

  stats: [
    { labelKey: "did", valueKey: "did", format: "text", icon: "user" },
    { labelKey: "format", valueKey: "format", format: "text", icon: "file-text" },
    { labelKey: "providerCount", valueKey: "providerCount", format: "number", icon: "users" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "did", valueKey: "did", format: "text" },
      { labelKey: "format", valueKey: "format", format: "text" },
      { labelKey: "providerCount", valueKey: "providerCount", format: "number" },
      { labelKey: "secretName", valueKey: "secretName", format: "text" },
    ],
  },

  features: { chainWarning: false },

  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],

  permissions: { datafeed: true },
};
