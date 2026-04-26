/**
 * Self-Loan Manifest
 *
 * Declarative configuration for the DeFi self-loan miniapp.
 * Users lock NEO as collateral and borrow GAS with tiered LTV.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  // ── Identity ─────────────────────────────────────────────────────────
  name: "SelfLoan",
  description: "Lock NEO, borrow GAS, and route collateral voting through ProfitAnchor",
  icon: "dollar-sign",
  category: "defi",
  shell: "launcher",

  // ── Tabs ──────────────────────────────────────────────────────────────
  tabs: [
    { key: "main", labelKey: "main", icon: "dollar-sign", default: true },
    { key: "stats", labelKey: "stats", icon: "bar-chart" },
  ],

  // ── Stats Grid ────────────────────────────────────────────────────────
  stats: [
    { labelKey: "borrowed", valueKey: "borrowedDisplay", format: "gas", variant: "accent", icon: "trending-up" },
    { labelKey: "collateralLocked", valueKey: "collateralDisplay", format: "text", icon: "lock" },
    { labelKey: "healthFactor", valueKey: "healthFactorDisplay", format: "text", icon: "heart" },
    { labelKey: "currentLTV", valueKey: "currentLTVDisplay", format: "text", icon: "percent" },
    { labelKey: "profitAnchorTitle", valueKey: "profitAnchorValue", format: "text", icon: "trending-up" },
    { labelKey: "totalLoans", valueKey: "totalLoans", format: "number", icon: "list" },
    { labelKey: "totalBorrowed", valueKey: "totalBorrowedDisplay", format: "gas", icon: "dollar-sign" },
    { labelKey: "totalRepaid", valueKey: "totalRepaidDisplay", format: "gas", icon: "check-circle" },
  ],

  // ── Sidebar ───────────────────────────────────────────────────────────
  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "sidebarHasLoan", valueKey: "hasLoanDisplay", format: "text" },
      { labelKey: "sidebarNeoBalance", valueKey: "neoBalanceDisplay", format: "number" },
      { labelKey: "healthFactor", valueKey: "healthFactorDisplay", format: "text" },
      { labelKey: "currentLTV", valueKey: "currentLTVDisplay", format: "text" },
      { labelKey: "profitAnchorStatus", valueKey: "profitAnchorValue", format: "text" },
    ],
  },

  // ── Features ──────────────────────────────────────────────────────────
  features: {
    fireworks: true,
    walletRequired: true,
    chainWarning: true,
  },

  // ── Docs (How It Works) ───────────────────────────────────────────────
  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
    { titleKey: "profitAnchorTitle", contentKey: "profitAnchorStatus", type: "features" },
  ],

  // ── Contract ──────────────────────────────────────────────────────────
  contract: {
    mode: "custom",
  },

  // ── Permissions ───────────────────────────────────────────────────────
  permissions: {
    payments: true,
    governance: true,
  },
};
