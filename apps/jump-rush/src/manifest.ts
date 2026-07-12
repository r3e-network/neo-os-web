import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Jump Rush",
  description:
    "A polished Phaser platform-jumping game with illustrated bunny, carrot, cloud, and grass-platform artwork; tactile hold-and-release controls; three route lengths; recovery after a missed landing; and free local play. The wallet-backed reward lane stays gated until its deployed contract and Morpheus session protocol pass end-to-end production validation.",
  icon: "zap",
  category: "game",
  shell: "game",
  supportsGuest: true,
  supportsGameFi: false,

  gamePage: {
    categoryColor: "#38BDF8",
    modes: { guest: true, gamefi: false },
    heroBadgeKey: "guestModeValue",
    heroTitleKey: "appEyebrow",
    heroTitleAccent: "appEyebrow",
    heroDescKey: "guestSubtitle",
    primaryLabelKey: "startAction",
    ghostLabelKey: "rulesTitle",
    featuresEyebrowKey: "guestModeValue",
    featuresTitleKey: "gameplayFeatureTitle",
    features: [
      {
        titleKey: "gameplayFeatureTitle",
        descKey: "gameplayFeatureCopy",
        large: true,
        gradient: "linear-gradient(135deg, #F0F9FF 0%, #BAE6FD 46%, #38BDF8 100%)",
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
    trustBadgeKeys: ["guestModeValue", "gameplayFeatureTitle", "rankLabel"],
  },

  tabs: [
    { key: "play", labelKey: "playTab", icon: "zap", default: true },
    { key: "ranks", labelKey: "ranksTab", icon: "award" },
  ],

  stats: [
    { labelKey: "guestBestLabel", valueKey: "myTotalWon", format: "text", variant: "success", icon: "trophy" },
    { labelKey: "guestRunsLabel", valueKey: "myRuns", format: "text", icon: "zap" },
    { labelKey: "myRank", valueKey: "myRank", format: "text", variant: "accent", icon: "award" },
  ],

  sidebar: {
    titleKey: "sidebarTitle",
    items: [
      { labelKey: "guestBestLabel", valueKey: "myTotalWon", format: "text" },
      { labelKey: "rankLabel", valueKey: "myRank", format: "text" },
      { labelKey: "guestRunsLabel", valueKey: "myRuns", format: "text" },
    ],
  },

  // Paid operations remain implemented for testnet hardening, but the public
  // release is deliberately fail-closed until the live TEE/contract schemas
  // and timing rules are aligned and an end-to-end settlement passes.
  operations: [],

  docs: [
    { titleKey: "rulesTitle", contentKey: "rulesCopy", type: "steps" },
    { titleKey: "fairnessTitle", contentKey: "fairnessCopy", type: "text" },
  ],

  features: {
    walletRequired: false,
    chainWarning: false,
    fireworks: true,
    activityFeed: false,
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
