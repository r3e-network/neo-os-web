import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Sudoku Arena",
  description:
    "Timed on-chain Sudoku with provably fair deals. Pay a small entry, solve the beacon-seeded puzzle before the deadline, and win a fixed GAS reward — 0.1 Easy, 0.5 Medium, 1 Hard. Placements are final: each on-chain undo burns 30% of the base reward (three max). Every solve climbs a global leaderboard rebuilt from chain events.",
  icon: "puzzle",
  category: "game",
  shell: "game",

  gamePage: {
    categoryColor: "#6366F1",
    modes: { guest: true },
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
        gradient: "linear-gradient(135deg, #EEF2FF 0%, #C7D2FE 46%, #6366F1 100%)",
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
          required: true,
          default: "0",
          options: [
            { value: "0", label: "Easy — win 0.1 GAS" },
            { value: "1", label: "Medium — win 0.5 GAS" },
            { value: "2", label: "Hard — win 1 GAS" },
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
