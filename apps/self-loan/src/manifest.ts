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
  description: "Lock NEO, borrow GAS instantly, and repay anytime — collateral held in custody, no liquidation",
  icon: "dollar-sign",
  category: "defi",
  shell: "launcher",

  // ── Tabs ──────────────────────────────────────────────────────────────
  tabs: [
    { key: "main", labelKey: "main", icon: "dollar-sign", default: true },
  ],

  // ── Stats Grid ────────────────────────────────────────────────────────
  stats: [
    { labelKey: "borrowed", valueKey: "borrowedDisplay", format: "gas", variant: "accent", icon: "trending-up" },
    { labelKey: "collateralLocked", valueKey: "collateralDisplay", format: "text", icon: "lock" },
    { labelKey: "coverageRatio", valueKey: "coverageRatioDisplay", format: "text", icon: "shield" },
    { labelKey: "currentLTV", valueKey: "currentLTVDisplay", format: "text", icon: "percent" },
  ],

  // ── Sidebar ───────────────────────────────────────────────────────────
  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "sidebarHasLoan", valueKey: "hasLoanDisplay", format: "text" },
      { labelKey: "sidebarNeoBalance", valueKey: "neoBalanceDisplay", format: "number" },
      { labelKey: "coverageRatio", valueKey: "coverageRatioDisplay", format: "text" },
      { labelKey: "currentLTV", valueKey: "currentLTVDisplay", format: "text" },
      { labelKey: "custodyStatus", valueKey: "custodyValue", format: "text" },
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
    { titleKey: "custodyTitle", contentKey: "custodyValue", type: "features" },
  ],

  // ── Contract ──────────────────────────────────────────────────────────
  contract: {
    mode: "custom",
  },

  // ── Permissions ───────────────────────────────────────────────────────
  permissions: {
    payments: true,
    governance: false,
  },
};
