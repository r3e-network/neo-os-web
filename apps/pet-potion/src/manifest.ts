import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Pet Potion",
  description:
    "A warm Phaser pet-care and potion-brewing game built around illustrated pets, care tools, nursery paths, balanced stats, ingredient collection, evolution, and a complete local brew-and-save loop. New wallet-funded runs stay gated until the deployed pool and the full Morpheus settlement path have production evidence; historical recovery remains available in the runtime.",
  icon: "heart",
  category: "game",
  shell: "game",
  supportsGuest: true,
  supportsGameFi: false,

  gamePage: {
    categoryColor: "#14B8A6",
    modes: { guest: true, gamefi: false },
    heroBadgeKey: "networkBadge",
    heroTitleKey: "appEyebrow",
    heroTitleAccent: "appEyebrow",
    heroDescKey: "appSubtitle",
    primaryLabelKey: "startAction",
    ghostLabelKey: "rulesTitle",
    featuresEyebrowKey: "networkBadge",
    featuresTitleKey: "gameplayFeatureTitle",
    features: [
      {
        titleKey: "gameplayFeatureTitle",
        descKey: "gameplayFeatureCopy",
        large: true,
        gradient: "linear-gradient(135deg, #F0FDFA 0%, #99F6E4 44%, #14B8A6 100%)",
      },
      { titleKey: "difficultyTitle", descKey: "guestStartDescription" },
      { titleKey: "leaderboardTitle", descKey: "guestLeaderboardIntro" },
    ],
    lbEyebrowKey: "ranksTab",
    lbTitleKey: "leaderboardTitle",
    lbScoreLabelKey: "guestBestLabel",
    ctaTitleKey: "lobbyTitle",
    ctaDescKey: "guestStartDescription",
    ctaLabelKey: "startAction",
    trustBadgeKeys: ["guestRunValue", "gameplayFeatureTitle", "rankLabel"],
  },

  tabs: [
    { key: "play", labelKey: "playTab", icon: "grid", default: true },
    { key: "ranks", labelKey: "ranksTab", icon: "award" },
  ],

  stats: [
    { labelKey: "guestBestLabel", valueKey: "myTotalWon", format: "text", variant: "success", icon: "trophy" },
    { labelKey: "historyTitle", valueKey: "mySolves", format: "text", icon: "heart" },
    { labelKey: "rankLabel", valueKey: "myRank", format: "text", variant: "accent", icon: "award" },
  ],

  sidebar: {
    titleKey: "sidebarTitle",
    items: [
      { labelKey: "guestBestLabel", valueKey: "myTotalWon", format: "text" },
      { labelKey: "rankLabel", valueKey: "myRank", format: "text" },
      { labelKey: "historyTitle", valueKey: "mySolves", format: "text" },
    ],
  },

  // Historical GameFi recovery remains implemented, but the public operation
  // panel exposes no wallet-funded start while live production evidence is
  // incomplete. Runtime startGame has an independent fail-closed guard.
  operations: [],

  docs: [
    { titleKey: "rulesTitle", contentKey: "rulesCopy", type: "steps" },
    { titleKey: "fairnessTitle", contentKey: "fairnessCopy", type: "text" },
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
