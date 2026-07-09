import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Merge Kingdom",
  description:
    "Timed on-chain tile-merging puzzle with provably fair TEE-generated boards. Tap tiles to move them — merge equal numbers to grow towards the target tile (64/256/1024). Win a fixed GAS reward: 0.1 Easy, 0.5 Medium, 1 Hard. Every solve climbs a global leaderboard rebuilt from chain events.",
  icon: "swords",
  category: "game",
  shell: "game",

  gamePage: {
    categoryColor: "#A855F7",
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
        gradient: "linear-gradient(135deg, #FAF5FF 0%, #DDD6FE 44%, #A855F7 100%)",
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
