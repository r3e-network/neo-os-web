import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "2048 Rush",
  description:
    "A polished local 2048 game with tactile tile merges, three target lanes, keyboard and swipe controls, and no wallet or GAS at risk.",
  icon: "layout",
  category: "game",
  shell: "game",
  directPlay: true,
  supportsGuest: true,
  // Contract, oracle, and TEE liveness pass on testnet, but freePool() is 0.
  // Hide and fail-close paid starts until the pool is funded and a complete
  // wallet -> TEE -> settlement run is revalidated.
  supportsGameFi: false,

  gamePage: {
    categoryColor: "#F59E0B",
    modes: { guest: true, gamefi: false },
    heroBadgeKey: "networkBadge",
    heroTitleKey: "appEyebrow",
    heroTitleAccent: "appEyebrow",
    heroDescKey: "appSubtitle",
    primaryLabelKey: "startAction",
    ghostLabelKey: "rulesTitle",
    featuresEyebrowKey: "networkBadge",
    featuresTitleKey: "fairnessTitle",
    features: [
      {
        titleKey: "fairnessTitle",
        descKey: "fairnessCopy",
        large: true,
        gradient: "linear-gradient(135deg, #FFFBEB 0%, #FDE68A 44%, #F59E0B 100%)",
      },
      { titleKey: "difficultyTitle", descKey: "startDescription" },
      { titleKey: "leaderboardTitle", descKey: "leaderboardIntro" },
    ],
    lbEyebrowKey: "ranksTab",
    lbTitleKey: "leaderboardTitle",
    lbScoreLabelKey: "scoreWon",
    ctaTitleKey: "lobbyTitle",
    ctaDescKey: "startDescription",
    ctaLabelKey: "startAction",
    trustBadgeKeys: ["networkBadge", "fairnessTitle", "rankLabel"],
  },

  tabs: [
    { key: "play", labelKey: "playTab", icon: "grid", default: true },
    { key: "ranks", labelKey: "ranksTab", icon: "award" },
  ],

  stats: [
    { labelKey: "scoreReward", valueKey: "lastPayout", format: "text", variant: "success", icon: "trophy" },
    { labelKey: "scoreWon", valueKey: "myTotalWon", format: "text", icon: "coin" },
    { labelKey: "rankLabel", valueKey: "myRank", format: "text", variant: "accent", icon: "award" },
  ],

  sidebar: {
    titleKey: "sidebarTitle",
    items: [
      { labelKey: "scoreWon", valueKey: "myTotalWon", format: "text" },
      { labelKey: "rankLabel", valueKey: "myRank", format: "text" },
      { labelKey: "creditLabel", valueKey: "credit", format: "text" },
    ],
  },

  operations: [],

  docs: [
    { titleKey: "rulesTitle", contentKey: "guestRulesCopy", type: "steps" },
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
    confidential: false,
    oracle: false,
  },

  contract: {
    mode: "shared",
    moduleId: "platform-game",
    registry: "0x5ec036efaa1fbde3ff7d1587d790768bc098cb2b",
    engine: "0xc75b181b4561462903bb27d8d9e0b32b637bec12",
  },
};
