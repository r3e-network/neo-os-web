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

  // The designed registry desk already owns availability, wallet state,
  // owned names, expiry, and lifecycle actions. Generic stat/sidebar blocks
  // would duplicate that hierarchy and turn the app back into a dashboard.
  stats: [],
  sidebar: { titleKey: "title", items: [] },
  operations: [],

  // Search and price inspection are public, read-only journeys. Wallet
  // connection is requested only at register/renew/route/transfer boundaries.
  features: { walletRequired: false, chainWarning: true },

  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],

  permissions: { payments: true },

  contract: { mode: "custom" },
};
