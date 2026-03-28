/**
 * Last Survivor Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the miniapp *except* the play area.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  // ── Identity ─────────────────────────────────────────────────────────
  name: "Last Survivor",
  description: "Last buyer wins the entire prize pool",
  icon: "skull",
  category: "game",
  shell: "launcher",

  // ── Tabs ──────────────────────────────────────────────────────────────
  tabs: [
    { key: "game", labelKey: "title", icon: "skull", default: true },
    { key: "stats", labelKey: "tabStats", icon: "bar-chart" },
    { key: "history", labelKey: "history", icon: "scroll" },
  ],

  // ── Stats Grid ────────────────────────────────────────────────────────
  stats: [
    { labelKey: "round", valueKey: "formattedRound", format: "text", icon: "refresh-cw" },
    { labelKey: "totalPot", valueKey: "totalPotDisplay", format: "text", variant: "warning", icon: "dollar-sign" },
    { labelKey: "yourKeys", valueKey: "userKeys", format: "number", icon: "key" },
    { labelKey: "lastBuyer", valueKey: "lastBuyerLabel", format: "text", icon: "user" },
    { labelKey: "roundStatus", valueKey: "roundStatusDisplay", format: "text", icon: "activity" },
  ],

  // ── Sidebar ───────────────────────────────────────────────────────────
  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "tabStats", valueKey: "formattedRound", format: "text" },
      { labelKey: "sidebarTotalPot", valueKey: "totalPotDisplay", format: "text" },
      { labelKey: "sidebarYourKeys", valueKey: "userKeys", format: "number" },
      { labelKey: "sidebarTimeLeft", valueKey: "countdown", format: "text" },
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
    { titleKey: "title", contentKey: "subtitle", type: "text" },
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
