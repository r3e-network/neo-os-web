import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Curve Arrow",
  description:
    "A warm, resource-driven Phaser archery game with three handcrafted-feeling ranges, press-and-hold curved flight, animated launches and impacts, local best scores, and complete free-play replay and recovery loops. New wallet-funded runs stay gated until a deployed Curve Arrow contract and full Morpheus settlement path have production evidence; historical recovery remains available in the runtime.",
  icon: "target",
  category: "game",
  shell: "game",
  supportsGuest: true,
  supportsGameFi: false,

  gamePage: {
    // Matches the app's --mx2-brand override (src/PlayArea.scss); the splash
    // shell injects this as its --n3h-accent inline, so it must be the same
    // warm range orange the in-game shell renders.
    categoryColor: "#d7742f",
    modes: { guest: true, gamefi: false },
    heroBadgeKey: "guestBadge",
    heroTitleKey: "appEyebrow",
    heroTitleAccent: "appEyebrow",
    heroDescKey: "appSubtitle",
    primaryLabelKey: "startAction",
    ghostLabelKey: "rulesTitle",
    featuresEyebrowKey: "guestBadge",
    featuresTitleKey: "gameplayFeatureTitle",
    features: [
      {
        titleKey: "gameplayFeatureTitle",
        descKey: "gameplayFeatureCopy",
        large: true,
        gradient: "linear-gradient(135deg, #fff8e8 0%, #ffdba8 48%, #d7742f 100%)",
      },
      { titleKey: "difficultyTitle", descKey: "guestModeLine" },
      { titleKey: "guestBestMetric", descKey: "guestBestFeatureCopy" },
    ],
    lbEyebrowKey: "ranksTab",
    lbTitleKey: "leaderboardTitle",
    lbScoreLabelKey: "guestBestMetric",
    ctaTitleKey: "lobbyTitle",
    ctaDescKey: "guestModeLine",
    ctaLabelKey: "startAction",
    trustBadgeKeys: ["guestBadge", "gameplayFeatureTitle", "guestBestMetric"],
  },

  tabs: [
    { key: "play", labelKey: "playTab", icon: "grid", default: true },
    { key: "ranks", labelKey: "ranksTab", icon: "award" },
  ],

  stats: [
    { labelKey: "guestBestMetric", valueKey: "myTotalWon", format: "text", variant: "success", icon: "trophy" },
    { labelKey: "historyTitle", valueKey: "mySolves", format: "text", icon: "activity" },
    { labelKey: "rankLabel", valueKey: "myRank", format: "text", variant: "accent", icon: "award" },
  ],

  sidebar: {
    titleKey: "sidebarTitle",
    items: [
      { labelKey: "guestBestMetric", valueKey: "myTotalWon", format: "text" },
      { labelKey: "rankLabel", valueKey: "myRank", format: "text" },
      { labelKey: "historyTitle", valueKey: "mySolves", format: "text" },
    ],
  },

  operations: [],

  docs: [
    { titleKey: "rulesTitle", contentKey: "guestRulesCopy", type: "steps" },
    { titleKey: "localFairnessTitle", contentKey: "localFairnessCopy", type: "text" },
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
