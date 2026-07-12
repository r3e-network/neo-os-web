import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Aim Master",
  description:
    "Free local target practice: choose a lane, fire anywhere on the range as the moving reticle crosses the bullseye, and chain clean hits before time runs out. No wallet or GAS is required; verified GameFi stays closed until the testnet pool is funded and settlement is proven end to end.",
  icon: "crosshair",
  category: "game",
  shell: "game",
  supportsGuest: true,
  supportsGameFi: false,

  gamePage: {
    categoryColor: "#F97316",
    modes: { guest: true, gamefi: false },
    heroBadgeKey: "guestModeValue",
    heroTitleKey: "appEyebrow",
    heroTitleAccent: "appEyebrow",
    heroDescKey: "guestSubtitle",
    primaryLabelKey: "startAction",
    ghostLabelKey: "rulesTitle",
    featuresEyebrowKey: "guestModeValue",
    featuresTitleKey: "guestRulesTitle",
    features: [
      {
        titleKey: "guestRulesTitle",
        descKey: "guestRulesCopy",
        large: true,
        gradient: "linear-gradient(135deg, #FFF7ED 0%, #FDBA74 46%, #FB923C 100%)",
      },
      { titleKey: "difficultyTitle", descKey: "startDescription" },
      { titleKey: "leaderboardTitle", descKey: "leaderboardIntro" },
    ],
    lbEyebrowKey: "ranksTab",
    lbTitleKey: "leaderboardTitle",
    lbScoreLabelKey: "guestBestLabel",
    ctaTitleKey: "lobbyTitle",
    ctaDescKey: "guestRulesCopy",
    ctaLabelKey: "startAction",
    trustBadgeKeys: ["guestModeValue", "gameFiMaintenanceShort", "rankLabel"],
  },

  tabs: [
    { key: "play", labelKey: "playTab", icon: "target", default: true },
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
    { titleKey: "gameFiMaintenanceShort", contentKey: "gameFiMaintenanceShort", type: "text" },
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
