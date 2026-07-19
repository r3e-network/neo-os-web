import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Snake Bounty",
  description:
    "A bright, sprite-driven Phaser snake game with three bounty trails, responsive steering, animated growth, collision feedback, local best scores, and complete free-play restart and recovery loops. New wallet-funded runs stay gated until the deployed reward pool and full Morpheus settlement path have production evidence; historical recovery remains available in the runtime.",
  icon: "activity",
  category: "game",
  shell: "game",
  supportsGuest: true,
  supportsGameFi: false,

  gamePage: {
    // Matches the app's --mx2-brand override (src/PhaserPlayArea.scss); the splash
    // shell injects this as its --n3h-accent inline, so it must be the same
    // jade the in-game shell renders.
    categoryColor: "#00af92",
    // Two-mode entry: primary "Earn GAS" (GameFi) + secondary "Play free"
    // (guest = a fully local snake, no token/oracle/chain/reward).
    modes: { guest: true, gamefi: false },
    heroBadgeKey: "guestRewardBadge",
    heroTitleKey: "appEyebrow",
    heroTitleAccent: "appEyebrow",
    heroDescKey: "appSubtitle",
    primaryLabelKey: "startAction",
    ghostLabelKey: "rulesTitle",
    featuresEyebrowKey: "guestRewardBadge",
    featuresTitleKey: "gameplayFeatureTitle",
    features: [
      {
        titleKey: "gameplayFeatureTitle",
        descKey: "gameplayFeatureCopy",
        large: true,
        // Jade ramp built from the app's brand-light/subtle/brand values so the
        // splash feature card reads in the same green family as the CTA.
        gradient: "linear-gradient(135deg, #e4f8f2 0%, #bdeadf 46%, #00af92 100%)",
      },
      { titleKey: "difficultyTitle", descKey: "guestModeLine" },
      { titleKey: "guestBestLabel", descKey: "guestBestFeatureCopy" },
    ],
    lbEyebrowKey: "guestRanksTab",
    lbTitleKey: "guestLeaderboardTitle",
    lbScoreLabelKey: "guestBestLabel",
    ctaTitleKey: "lobbyTitle",
    ctaDescKey: "guestModeLine",
    ctaLabelKey: "startAction",
    trustBadgeKeys: ["guestRewardBadge", "gameplayFeatureTitle", "guestBestLabel"],
  },

  tabs: [
    { key: "play", labelKey: "playTab", icon: "grid", default: true },
    { key: "ranks", labelKey: "guestRanksTab", icon: "award" },
  ],

  stats: [
    { labelKey: "guestBestLabel", valueKey: "myTotalWon", format: "text", variant: "success", icon: "trophy" },
    { labelKey: "historyTitle", valueKey: "mySolves", format: "text", icon: "activity" },
  ],

  sidebar: {
    titleKey: "sidebarTitle",
    items: [
      { labelKey: "guestBestLabel", valueKey: "myTotalWon", format: "text" },
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
