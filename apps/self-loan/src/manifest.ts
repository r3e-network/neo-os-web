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
    { labelKey: "borrowed", valueKey: "borrowedDisplay", format: "gas", variant: "accent", icon: "trending-up", pendingKey: "selfLoanReading" },
    { labelKey: "collateralLocked", valueKey: "collateralDisplay", format: "text", icon: "lock", pendingKey: "selfLoanReading" },
    { labelKey: "coverageRatio", valueKey: "coverageRatioDisplay", format: "text", icon: "shield", pendingKey: "selfLoanReading" },
    { labelKey: "currentLTV", valueKey: "currentLTVDisplay", format: "text", icon: "percent", pendingKey: "selfLoanReading" },
  ],

  // ── Sidebar ───────────────────────────────────────────────────────────
  // The chrome renders these with no loading gate of its own, so every binding
  // whose value comes from a chain read declares `pendingKey`: until getLoan /
  // the balance read settles the bound observable holds `undefined` and the
  // chrome says "Reading…" instead of answering.
  //
  // `hasLoanDisplay` is why this matters most: it used to answer straight off
  // the resting `{ active: false }` position and tell a borrower "No" — a
  // confident negative about their own loan, published before the read that
  // could contradict it. It now says nothing until it knows.
  //
  // "Connect wallet" and "N/A" are NOT pending copy: they are settled facts the
  // observables report as real values. `custodyValue` holds a constant and is
  // never unread.
  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "sidebarHasLoan", valueKey: "hasLoanDisplay", format: "text", pendingKey: "selfLoanReading" },
      { labelKey: "sidebarNeoBalance", valueKey: "neoBalanceDisplay", format: "number", pendingKey: "selfLoanReading" },
      { labelKey: "coverageRatio", valueKey: "coverageRatioDisplay", format: "text", pendingKey: "selfLoanReading" },
      { labelKey: "currentLTV", valueKey: "currentLTVDisplay", format: "text", pendingKey: "selfLoanReading" },
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
    "invoke:platform-defi": true,
    payments: true,
    governance: false,
  },
};
