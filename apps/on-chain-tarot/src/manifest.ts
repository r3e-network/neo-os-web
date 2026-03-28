/**
 * On-Chain Tarot Manifest
 *
 * Declarative configuration for the blockchain-powered tarot reading miniapp.
 * Provides three-card readings using on-chain VRF for verifiable randomness.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  // -- Identity ---------------------------------------------------------------
  name: "On-Chain Tarot",
  description: "Blockchain-powered divination",
  icon: "star",
  category: "game",
  shell: "launcher",

  // -- Tabs -------------------------------------------------------------------
  tabs: [
    { key: "game", labelKey: "drawYourCards", icon: "star", default: true },
    { key: "stats", labelKey: "stats", icon: "bar-chart" },
  ],

  // -- Stats ------------------------------------------------------------------
  stats: [
    { labelKey: "readings", valueKey: "readingsCount", format: "number", icon: "book" },
    { labelKey: "cardsDrawnCount", valueKey: "cardsDrawnCount", format: "number", icon: "layers" },
    { labelKey: "allRevealed", valueKey: "allRevealedDisplay", format: "text", icon: "eye" },
  ],

  // -- Sidebar ----------------------------------------------------------------
  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "readings", valueKey: "readingsCount", format: "number" },
      { labelKey: "cardsDrawnCount", valueKey: "cardsDrawnCount", format: "number" },
      { labelKey: "allRevealed", valueKey: "allRevealedDisplay", format: "text" },
    ],
  },

  // -- Features ---------------------------------------------------------------
  features: {
    walletRequired: true,
    chainWarning: true,
  },

  // -- Docs -------------------------------------------------------------------
  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step1", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
    { titleKey: "feature2Name", contentKey: "feature2Desc", type: "features" },
    { titleKey: "feature3Name", contentKey: "feature3Desc", type: "features" },
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
