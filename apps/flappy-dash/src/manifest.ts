import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Flappy Dash",
  description:
    "Tap to fly through TEE-generated pipes in this on-chain Flappy Bird-style challenge. Pick a flight route, clear the target pipes before the clock runs out, and win a fixed GAS reward — 0.1 Meadow Hop (5 pipes), 0.5 Sky Sprint (10 pipes), 1 Pipe Gauntlet (20 pipes). Every completed run climbs a global leaderboard rebuilt from chain events.",
  icon: "cloud",
  category: "game",
  shell: "game",

  // ── Steam-style Game Landing Page ──────────────────────────────────
  gamePage: {
    appIcon: "🐦",
    categoryColor: "#10B981",
    heroBadgeKey: "homeBadge",
    heroTitleKey: "homeTitle",
    heroTitleAccent: "homeTitleAccent",
    heroDescKey: "homeDesc",
    primaryLabelKey: "startAction",
    ghostLabelKey: "homeHowToPlay",
    featuresEyebrowKey: "homeBadge",
    featuresTitleKey: "homeFeatureTee",
    features: [
      {
        icon: "🔒", titleKey: "homeFeatureTee", descKey: "homeFeatureTeeDesc",
        large: true,
        gradient: "linear-gradient(135deg, #064E3B 0%, #059669 40%, #10B981 100%)",
      },
      { icon: "⚡", titleKey: "homeFeatureDifficulty", descKey: "homeFeatureDifficultyDesc" },
      { icon: "🏆", titleKey: "homeFeatureRank", descKey: "homeFeatureRankDesc" },
    ],
    lbEyebrowKey: "homeLbEyebrow",
    lbTitleKey: "homeLbTitle",
    lbScoreLabelKey: "homeLbScoreLabel",
    ctaTitleKey: "homeCtaTitle",
    ctaDescKey: "homeCtaDesc",
    ctaLabelKey: "homeCtaLabel",
    trustBadgeKeys: ["homeTrustBadge1", "homeTrustBadge2", "homeTrustBadge3"],
  },

  tabs: [
    { key: "play", labelKey: "playTab", icon: "airplay", default: true },
    { key: "ranks", labelKey: "ranksTab", icon: "award" },
  ],

  stats: [
    { labelKey: "homePoolStat", valueKey: "poolFree", format: "text", variant: "accent", icon: "coins" },
    { labelKey: "homeWonStat", valueKey: "myTotalWon", format: "text", icon: "coin" },
    { labelKey: "homeSolvesStat", valueKey: "mySolves", format: "text", icon: "check-circle" },
    { labelKey: "homeRankStat", valueKey: "myRank", format: "text", variant: "accent", icon: "award" },
  ],

  sidebar: {
    titleKey: "sidebarTitle",
    items: [
      { labelKey: "scoreWon", valueKey: "myTotalWon", format: "text" },
      { labelKey: "rankLabel", valueKey: "myRank", format: "text" },
      { labelKey: "creditLabel", valueKey: "credit", format: "text" },
    ],
  },

  operations: [
    {
      key: "startGame",
      titleKey: "startAction",
      descriptionKey: "startDescription",
      actionKey: "startAction",
      actionMethod: "startGame",
      priority: "primary",
      fields: [
        {
          key: "difficulty",
          type: "select",
          labelKey: "difficultyTitle",
          hidden: true,
          required: true,
          default: "0",
          options: [
            { value: "0", label: "Meadow Hop — pass 5 pipes, win 0.1 GAS" },
            { value: "1", label: "Sky Sprint — pass 10 pipes, win 0.5 GAS" },
            { value: "2", label: "Pipe Gauntlet — pass 20 pipes, win 1 GAS" },
          ],
        },
      ],
    },
    {
      key: "withdrawWinnings",
      titleKey: "withdrawTitle",
      descriptionKey: "withdrawHint",
      actionKey: "withdrawTitle",
      actionMethod: "withdrawWinnings",
      priority: "secondary",
      fields: [],
    },
  ],

  docs: [
    { titleKey: "rulesTitle", contentKey: "rulesCopy", type: "steps" },
    { titleKey: "fairnessTitle", contentKey: "fairnessCopy", type: "text" },
  ],

  features: {
    walletRequired: true,
    chainWarning: true,
    fireworks: true,
    activityFeed: true,
    reviews: true,
    comments: true,
  },

  permissions: {
    payments: true,
    randomness: true,
    compute: true,
    oracle: true,
  },

  contract: {
    mode: "custom",
  },
};
