/**
 * Flash Loan Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the flashloan miniapp except the play area.
 *
 * The platform reads this manifest and renders:
 *   - Tabs (main status, activity stats, docs)
 *   - Sidebar items bound to reactive state keys
 *   - Stats grid cards bound to reactive state keys
 *   - Operation panel for loan status lookup
 *   - Docs / how-it-works section
 *   - Feature flags (wallet requirement, etc.)
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  // ── Identity ─────────────────────────────────────────────────────────
  name: "Flash Loan",
  description: "Atomic flash loans on Neo N3 — borrow and repay in a single transaction",
  icon: "zap",
  category: "defi",
  shell: "launcher",

  // ── Tabs ──────────────────────────────────────────────────────────────
  tabs: [
    { key: "main", labelKey: "main", icon: "zap", default: true },
    { key: "stats", labelKey: "stats", icon: "bar-chart" },
  ],

  // ── Stats Grid ────────────────────────────────────────────────────────
  stats: [
    { labelKey: "sidebarPoolBalance", valueKey: "poolBalance", format: "gas", variant: "accent", icon: "droplet" },
    { labelKey: "totalLoans", valueKey: "totalLoans", format: "number", icon: "hash" },
    { labelKey: "totalVolume", valueKey: "totalVolume", format: "gas", icon: "trending-up" },
    { labelKey: "totalFees", valueKey: "totalFees", format: "gas", icon: "percent" },
    { labelKey: "avgLoanSize", valueKey: "avgLoanSize", format: "gas", icon: "bar-chart-2" },
  ],

  // ── Sidebar ───────────────────────────────────────────────────────────
  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "sidebarPoolBalance", valueKey: "poolBalance", format: "gas" },
      { labelKey: "sidebarRecentLoans", valueKey: "recentLoansCount", format: "number" },
      { labelKey: "sidebarTotalLoans", valueKey: "totalLoans", format: "number" },
      { labelKey: "sidebarTotalVolume", valueKey: "totalVolume", format: "gas" },
    ],
  },

  // ── Operations ────────────────────────────────────────────────────────
  operations: [
    {
      key: "lookupLoan",
      titleKey: "statusLookup",
      actionKey: "checkStatus",
      actionMethod: "lookupLoan",
      fields: [
        {
          key: "loanId",
          type: "text",
          labelKey: "loanId",
          placeholder: "loanIdPlaceholder",
          required: true,
        },
      ],
    },
  ],

  // ── Features ──────────────────────────────────────────────────────────
  features: {
    walletRequired: true,
    chainWarning: true,
  },

  // ── Docs ──────────────────────────────────────────────────────────────
  docs: [
    { titleKey: "docTitle", contentKey: "docDescription", type: "text" },
    { titleKey: "howToUse", contentKey: "deployCallbackDesc", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
    { titleKey: "feature2Name", contentKey: "feature2Desc", type: "features" },
  ],

  // ── Contract ──────────────────────────────────────────────────────────
  contract: {
    mode: "custom",
  },

  // ── Permissions ───────────────────────────────────────────────────────
  permissions: {
    payments: true,
  },
};
