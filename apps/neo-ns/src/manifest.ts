/**
 * Neo Name Service Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the miniapp *except* the play area.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Neo Name Service",
  description: "Register and manage .neo domains",
  icon: "globe",
  category: "tool",
  shell: "launcher",

  tabs: [
    { key: "register", labelKey: "tabRegister", icon: "plus", default: true },
  ],

  stats: [
    { labelKey: "tabDomains", valueKey: "domainCount", format: "number", icon: "globe" },
    { labelKey: "sidebarExpiringSoon", valueKey: "expiringSoon", format: "number", variant: "warning", icon: "alert-triangle" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "tabDomains", valueKey: "domainCount", format: "number" },
      { labelKey: "sidebarWallet", valueKey: "walletStatus", format: "text" },
      { labelKey: "sidebarExpiringSoon", valueKey: "expiringSoon", format: "number" },
    ],
  },

  features: { walletRequired: true, chainWarning: true },

  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],

  permissions: { payments: true },

  contract: { mode: "custom" },
};
