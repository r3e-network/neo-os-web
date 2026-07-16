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
    // Launcher chips are this release's selling points. "GameFi validation in
    // progress" (gameFiValidationShort) captioned an absent mode on a
    // store-facing hero; ruleTimer states an actual mechanic instead. The key
    // itself stays — PhaserPlayArea still uses it for the in-game
    // "paid-disabled" status, which fires on a real attempted action.
    trustBadgeKeys: ["guestBadge", "ruleTimer", "guestStreakLabel"],
  },

  // ── Tabs ──────────────────────────────────────────────────────────────
  tabs: [
    { key: "game", labelKey: "title", icon: "skull", default: true },
    { key: "stats", labelKey: "tabStats", icon: "bar-chart" },
    { key: "history", labelKey: "history", icon: "scroll" },
  ],

  // ── Stats Grid ────────────────────────────────────────────────────────
  // These bind straight into shell chrome that MiniAppRoot renders with no
  // loading gate of its own, so each declares `pendingKey`: while the round read
  // is in flight the bound observable holds `undefined` and the chrome says
  // "Reading…" instead of publishing "N/A" — a dashed prize pot on a pot-based
  // game, the first thing a visitor reads. A read that SETTLES with no round
  // keeps its own honest "N/A" reading. `yourKeys` binds `userKeysDisplay` so
  // the unread state is a pending phase, never a fabricated 0. See
  // composables/useLastSurvivor.ts.
  stats: [
    { labelKey: "round", valueKey: "formattedRound", format: "text", icon: "refresh-cw", pendingKey: "statReading" },
    { labelKey: "totalPot", valueKey: "totalPotDisplay", format: "text", variant: "warning", icon: "dollar-sign", pendingKey: "statReading" },
    { labelKey: "yourKeys", valueKey: "userKeysDisplay", format: "number", icon: "key", pendingKey: "statReading" },
    { labelKey: "lastBuyer", valueKey: "lastBuyerLabel", format: "text", icon: "user", pendingKey: "statReading" },
    { labelKey: "roundStatus", valueKey: "roundStatusDisplay", format: "text", icon: "activity", pendingKey: "statReading" },
  ],

  // ── Sidebar ───────────────────────────────────────────────────────────
  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "tabStats", valueKey: "formattedRound", format: "text", pendingKey: "statReading" },
      { labelKey: "sidebarTotalPot", valueKey: "totalPotDisplay", format: "text", pendingKey: "statReading" },
      { labelKey: "sidebarYourKeys", valueKey: "userKeysDisplay", format: "number", pendingKey: "statReading" },
      { labelKey: "sidebarTimeLeft", valueKey: "countdown", format: "text", pendingKey: "statReading" },
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
