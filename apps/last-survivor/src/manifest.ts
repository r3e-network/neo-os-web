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
  description: "Reclaim the final seat from local rivals before the clock reaches zero",
  icon: "skull",
  category: "game",
  // "game" shell renders the focused two-CTA launcher entry (the only shell the
  // shared GameHomePageWrapper serves) — required for the guest opt-in below to
  // reach players, and consistent with every other guest-enabled game.
  shell: "game",

  // The free local drill is production-ready. New paid rounds remain hidden
  // until the refreshed frontend wallet/recovery build receives a complete
  // two-wallet browser pass. The v1.1 contract itself has already passed the
  // TestNet buy -> expiry -> settle -> withdraw harness; runtime guards remain
  // independent of launcher visibility.
  supportsGameFi: false,
  supportsGuest: true,

  gamePage: {
    categoryColor: "#F59E0B",
    appIcon: "skull",
    modes: { guest: true, gamefi: false },
    heroBadgeKey: "guestBadge",
    heroTitleKey: "guestStageTitle",
    heroTitleAccent: "guestStageTitle",
    heroDescKey: "guestStageSubtitle",
    primaryLabelKey: "guestPressToStay",
    ghostLabelKey: "rulesTitle",
    featuresEyebrowKey: "guestBadge",
    featuresTitleKey: "guestBoardTitle",
    features: [
      {
        titleKey: "guestRuleDeposit",
        descKey: "guestRuleDepositDesc",
        large: true,
        gradient: "linear-gradient(135deg, #FFF8E7 0%, #FDE68A 48%, #FB923C 100%)",
      },
      { titleKey: "ruleTimer", descKey: "guestRuleTimerDesc" },
      { titleKey: "guestYouLeader", descKey: "guestRuleWinDesc" },
    ],
    lbEyebrowKey: "guestBadge",
    lbTitleKey: "guestBoardTitle",
    lbScoreLabelKey: "guestStreakLabel",
    ctaTitleKey: "guestStageTitle",
    ctaDescKey: "guestStageSubtitle",
    ctaLabelKey: "guestPressToStay",
    trustBadgeKeys: ["guestBadge", "gameFiValidationShort", "guestStreakLabel"],
  },

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
    walletRequired: false,
    chainWarning: false,
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
    payments: false,
  },
};
