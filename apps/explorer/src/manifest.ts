/**
 * Explorer Manifest
 *
 * Declarative configuration for the blockchain explorer miniapp.
 * This is a READ-ONLY tool — no wallet or payments required.
 *
 * The platform renders tabs, sidebar, stats, and docs from this config.
 * The miniapp only provides PlayArea.vue (search + results) and
 * useExplorer.ts (data fetching logic).
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  // ── Identity ─────────────────────────────────────────────────────────
  name: "Neo Explorer",
  description: "Search transactions, addresses, contracts",
  icon: "search",
  category: "tool",
  shell: "launcher",

  // ── Tabs ──────────────────────────────────────────────────────────────
  tabs: [
    { key: "search", labelKey: "tabSearch", icon: "search", default: true },
    { key: "stats", labelKey: "stats", icon: "bar-chart" },
  ],

  // ── Stats Grid ────────────────────────────────────────────────────────
  // Network-qualified labels so the four height/tx tiles read unambiguously in
  // host chrome (two unqualified "Block Height"/"Transactions" pairs were
  // indistinguishable and mismatched the PlayArea's active-network metrics).
  stats: [
    { labelKey: "mainnetHeightLabel", valueKey: "mainnetHeight", format: "number", icon: "box" },
    { labelKey: "mainnetTxLabel", valueKey: "mainnetTxCount", format: "number", icon: "activity" },
    { labelKey: "testnetHeightLabel", valueKey: "testnetHeight", format: "number", icon: "box" },
    { labelKey: "testnetTxLabel", valueKey: "testnetTxCount", format: "number", icon: "activity" },
    { labelKey: "sidebarNetwork", valueKey: "selectedNetwork", format: "text", icon: "globe" },
    { labelKey: "sidebarRecentTxs", valueKey: "recentTxCount", format: "number", icon: "list" },
  ],

  // ── Sidebar ───────────────────────────────────────────────────────────
  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "mainnetHeightLabel", valueKey: "mainnetHeight", format: "number" },
      { labelKey: "mainnetTxLabel", valueKey: "mainnetTxCount", format: "number" },
      { labelKey: "sidebarNetwork", valueKey: "selectedNetwork", format: "text" },
      { labelKey: "sidebarRecentTxs", valueKey: "recentTxCount", format: "number" },
    ],
  },

  // ── Features ──────────────────────────────────────────────────────────
  features: {
    fireworks: false,
    walletRequired: false,
    chainWarning: false,
  },

  // ── Docs (How It Works) ───────────────────────────────────────────────
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
  // Explorer is read-only — no special permissions needed.
  permissions: {},
};
