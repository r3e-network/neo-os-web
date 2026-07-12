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

  // The designed chamber owns navigation and live counts. Keep the shell from
  // re-introducing a generic tab/stat dashboard around it.
  tabs: [],
  stats: [],

  // ── Sidebar ───────────────────────────────────────────────────────────
  sidebar: {
    titleKey: "title",
    items: [],
  },

  // ── Features ──────────────────────────────────────────────────────────
  features: {
    walletRequired: false,
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
