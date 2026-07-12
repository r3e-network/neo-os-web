import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Merge Kingdom",
  description:
    "A free, resource-driven kingdom merge game. Drag matching buildings together, raise a stronger realm before time runs out, and resume unfinished local runs on this device. Paid GameFi entry remains unavailable until its pool, oracle callback, and full testnet flow are verified.",
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
    heroDescKey: "guestRulesCopy",
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
    ctaDescKey: "guestRulesCopy",
    ctaLabelKey: "startAction",
    trustBadgeKeys: ["guestRunValue", "gameFiMaintenanceShort", "rankLabel"],
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
    { titleKey: "gameFiMaintenanceShort", contentKey: "gameFiMaintenanceBody", type: "text" },
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
    mode: "custom",
  },
};
