import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Garden Arrowworks",
  description:
    "A warm, deterministic Phaser 3 escape-ray puzzle. Clear a dense mechanical garden by removing arrows in dependency order, with replayable seeds, verified solution witnesses, refresh recovery, pause, zoom, touch controls, and complete wallet-free guest play.",
  icon: "move-up-right",
  category: "game",
  shell: "game",
  supportsGuest: true,
  supportsGameFi: false,

  gamePage: {
    categoryColor: "#197C61",
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
        gradient: "linear-gradient(135deg, #fff9e9 0%, #e6f0d7 48%, #79aa7e 100%)",
      },
      { titleKey: "replayFeatureTitle", descKey: "replayFeatureCopy" },
      { titleKey: "localSafetyTitle", descKey: "localSafetyCopy" },
    ],
    lbEyebrowKey: "ranksTab",
    lbTitleKey: "bestScoreLabel",
    lbScoreLabelKey: "bestScoreLabel",
    ctaTitleKey: "lobbyTitle",
    ctaDescKey: "gameplayFeatureCopy",
    ctaLabelKey: "startAction",
    trustBadgeKeys: ["guestBadge", "replayFeatureTitle", "localSafetyTitle"],
  },

  tabs: [
    { key: "play", labelKey: "playTab", icon: "grid", default: true },
    { key: "ranks", labelKey: "ranksTab", icon: "trophy" },
  ],

  stats: [
    { labelKey: "bestScoreLabel", valueKey: "bestScore", format: "number", variant: "success", icon: "trophy" },
    { labelKey: "remainingStatLabel", valueKey: "remainingCount", format: "number", icon: "activity" },
  ],

  sidebar: {
    titleKey: "sidebarTitle",
    items: [
      { labelKey: "bestScoreLabel", valueKey: "bestScore", format: "number" },
      { labelKey: "remainingStatLabel", valueKey: "remainingCount", format: "number" },
      { labelKey: "statusLabel", valueKey: "lastStatus", format: "text" },
    ],
  },

  operations: [],

  docs: [
    { titleKey: "rulesTitle", contentKey: "rulesCopy", type: "steps" },
    { titleKey: "localSafetyTitle", contentKey: "localSafetyCopy", type: "text" },
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

};
