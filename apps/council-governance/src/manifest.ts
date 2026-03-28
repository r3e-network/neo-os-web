/**
 * Council Governance Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the miniapp *except* the play area.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  // ── Identity ─────────────────────────────────────────────────────────
  name: "Council Governance",
  description: "Neo council proposal management and voting",
  icon: "landmark",
  category: "governance",
  shell: "launcher",

  // ── Tabs ──────────────────────────────────────────────────────────────
  tabs: [
    { key: "active", labelKey: "active", icon: "landmark", default: true },
    { key: "create", labelKey: "create", icon: "edit" },
    { key: "history", labelKey: "history", icon: "scroll" },
  ],

  // ── Stats Grid ────────────────────────────────────────────────────────
  stats: [
    { labelKey: "active", valueKey: "activeCount", format: "number", variant: "accent", icon: "zap" },
    { labelKey: "totalProposals", valueKey: "totalProposals", format: "number", icon: "hash" },
    { labelKey: "votingPower", valueKey: "votingPower", format: "number", icon: "award" },
    { labelKey: "history", valueKey: "historyCount", format: "number", icon: "scroll" },
  ],

  // ── Sidebar ───────────────────────────────────────────────────────────
  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "active", valueKey: "activeCount", format: "number" },
      { labelKey: "history", valueKey: "historyCount", format: "number" },
      { labelKey: "totalProposals", valueKey: "totalProposals", format: "number" },
      { labelKey: "votingPower", valueKey: "votingPower", format: "number" },
    ],
  },

  // ── Features ──────────────────────────────────────────────────────────
  features: {
    fireworks: true,
    walletRequired: true,
    chainWarning: true,
  },

  // ── Docs ──────────────────────────────────────────────────────────────
  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],

  // ── Contract ──────────────────────────────────────────────────────────
  contract: {
    mode: "custom",
  },

  // ── Permissions ───────────────────────────────────────────────────────
  permissions: {
    governance: true,
  },
};
