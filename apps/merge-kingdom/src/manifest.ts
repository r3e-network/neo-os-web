import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Merge Kingdom",
  // Store-facing description: what this release is, not what it withholds. The
  // trailing "Paid GameFi entry remains unavailable until its pool, oracle
  // callback, and full testnet flow are verified" put release-engineering
  // status and testnet internals in store metadata.
  description:
    "A free, resource-driven kingdom merge game. Drag matching buildings together, raise a stronger realm before time runs out, and resume unfinished local runs on this device. No wallet, fee, or chain write is involved.",
  icon: "swords",
  category: "game",
  shell: "game",
  supportsGuest: true,
  supportsGameFi: false,

  gamePage: {
    categoryColor: "#B7791F",
    modes: { guest: true, gamefi: false },
    heroBadgeKey: "guestRunValue",
    heroTitleKey: "appEyebrow",
    heroTitleAccent: "appEyebrow",
    // Hero clamps at 138 chars; guestRulesCopy is 331 and truncated mid-clause.
    heroDescKey: "guestSubtitle",
    primaryLabelKey: "startAction",
    ghostLabelKey: "rulesTitle",
    featuresEyebrowKey: "guestRunValue",
    featuresTitleKey: "guestRulesTitle",
    features: [
      {
        titleKey: "guestRulesTitle",
        descKey: "guestRulesCopy",
        large: true,
        gradient: "linear-gradient(135deg, #FFF8E6 0%, #EDCF72 50%, #B7791F 100%)",
      },
      { titleKey: "difficultyTitle", descKey: "guestRoutesCopy" },
      { titleKey: "leaderboardTitle", descKey: "guestLeaderboardCopy" },
    ],
    lbEyebrowKey: "ranksTab",
    lbTitleKey: "leaderboardTitle",
    lbScoreLabelKey: "guestBestLabel",
    ctaTitleKey: "lobbyTitle",
    // CTA clamps at 160 — same over-long-rules problem as the hero had.
    ctaDescKey: "guestSubtitle",
    ctaLabelKey: "startAction",
    trustBadgeKeys: ["guestRunValue", "mergeMechanicBadge", "rankLabel"],
  },

  tabs: [
    { key: "play", labelKey: "playTab", icon: "grid", default: true },
    { key: "ranks", labelKey: "ranksTab", icon: "award" },
  ],

  stats: [
    { labelKey: "guestBestLabel", valueKey: "myTotalWon", format: "text", variant: "success", icon: "trophy" },
    { labelKey: "rankLabel", valueKey: "myRank", format: "text", variant: "accent", icon: "award" },
  ],

  sidebar: {
    titleKey: "sidebarTitle",
    items: [
      { labelKey: "guestBestLabel", valueKey: "myTotalWon", format: "text" },
      { labelKey: "rankLabel", valueKey: "myRank", format: "text" },
    ],
  },

  operations: [],

  docs: [
    { titleKey: "guestRulesTitle", contentKey: "guestRulesCopy", type: "steps" },
    { titleKey: "freePlayScopeTitle", contentKey: "freePlayScopeBody", type: "text" },
  ],

  features: {
    walletRequired: false,
    chainWarning: false,
    fireworks: true,
    activityFeed: true,
    reviews: true,
    comments: true,
  },

  permissions: {
    payments: false,
    randomness: false,
    compute: false,
    oracle: false,
  },

  contract: {
    mode: "shared",
    moduleId: "platform-game",
    registry: "0x5ec036efaa1fbde3ff7d1587d790768bc098cb2b",
    engine: "0xc75b181b4561462903bb27d8d9e0b32b637bec12",
  },
};
