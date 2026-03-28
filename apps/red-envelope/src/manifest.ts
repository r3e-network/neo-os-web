/**
 * Red Envelope Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the red-envelope miniapp except the play area.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  // -- Identity ---------------------------------------------------------------
  name: "Red Envelope",
  description: "Create and claim lucky red envelopes on Neo N3",
  icon: "gift",
  category: "social",
  shell: "launcher",

  // -- Tabs -------------------------------------------------------------------
  tabs: [
    { key: "create", labelKey: "createTab", icon: "gift", default: true },
    { key: "claim", labelKey: "claimTabLabel", icon: "target" },
    { key: "myEnvelopes", labelKey: "myEnvelopes", icon: "archive" },
  ],

  // -- Stats Grid -------------------------------------------------------------
  stats: [
    { labelKey: "sidebarEnvelopes", valueKey: "envelopeCount", format: "number", variant: "danger", icon: "gift" },
    { labelKey: "sidebarClaims", valueKey: "claimCount", format: "number", variant: "accent", icon: "check-circle" },
    { labelKey: "sidebarPools", valueKey: "poolCount", format: "number", icon: "users" },
  ],

  // -- Sidebar ----------------------------------------------------------------
  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "sidebarEnvelopes", valueKey: "envelopeCount", format: "number" },
      { labelKey: "sidebarClaims", valueKey: "claimCount", format: "number" },
      { labelKey: "sidebarPools", valueKey: "poolCount", format: "number" },
    ],
  },

  // -- Features ---------------------------------------------------------------
  features: {
    fireworks: true,
    walletRequired: true,
    chainWarning: true,
  },

  // -- Docs -------------------------------------------------------------------
  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],

  // -- Contract ---------------------------------------------------------------
  contract: {
    mode: "custom",
  },

  // -- Permissions ------------------------------------------------------------
  permissions: {
    payments: true,
  },
};
