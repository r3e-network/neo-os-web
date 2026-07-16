/**
 * Explorer Manifest
 *
 * Declarative configuration for the blockchain explorer miniapp.
 * This is a READ-ONLY tool — no wallet or payments required.
 *
 * The platform renders tabs, sidebar, stats, and docs from this config.
 * The miniapp provides a React PlayArea (search + results) and
 * useExplorer.ts (data fetching logic).
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  // ── Identity ─────────────────────────────────────────────────────────
  name: "Neo Explorer",
  description: "Search Neo N3 blocks, transactions, addresses, and contracts",
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
  // The chrome has no loading gate of its own, so every binding whose value is
  // read from chain declares `pendingKey`: until the read settles the bound
  // observable holds `undefined` and the chrome says "Syncing chain data"
  // rather than formatting the void into a dash — or, for `recentTxCount`, into
  // a fabricated `0` asserting the chain is idle. `selectedNetwork` needs no
  // pending phase: it holds a real default from the first tick and is never
  // unread.
  stats: [
    { labelKey: "mainnetHeightLabel", valueKey: "mainnetHeight", format: "number", icon: "box", pendingKey: "explorerDataLoading" },
    { labelKey: "mainnetTxLabel", valueKey: "mainnetTxCount", format: "number", icon: "activity", pendingKey: "explorerDataLoading" },
    { labelKey: "testnetHeightLabel", valueKey: "testnetHeight", format: "number", icon: "box", pendingKey: "explorerDataLoading" },
    { labelKey: "testnetTxLabel", valueKey: "testnetTxCount", format: "number", icon: "activity", pendingKey: "explorerDataLoading" },
    { labelKey: "sidebarNetwork", valueKey: "selectedNetwork", format: "text", icon: "globe" },
    { labelKey: "sidebarRecentTxs", valueKey: "recentTxCount", format: "number", icon: "list", pendingKey: "explorerDataLoading" },
  ],

  // ── Sidebar ───────────────────────────────────────────────────────────
  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "mainnetHeightLabel", valueKey: "mainnetHeight", format: "number", pendingKey: "explorerDataLoading" },
      { labelKey: "mainnetTxLabel", valueKey: "mainnetTxCount", format: "number", pendingKey: "explorerDataLoading" },
      { labelKey: "sidebarNetwork", valueKey: "selectedNetwork", format: "text" },
      { labelKey: "sidebarRecentTxs", valueKey: "recentTxCount", format: "number", pendingKey: "explorerDataLoading" },
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

  // ── Permissions ───────────────────────────────────────────────────────
  // Explorer is read-only — no special permissions needed.
  permissions: {},
};
