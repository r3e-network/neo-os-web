import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Pet Potion",
  description:
    "Timed on-chain virtual pet care game with provably fair TEE-nurtured pets. Choose a nursery path, feed, play, pet, and rest your magical creature to raise happiness before the deadline. Win a fixed GAS reward: 0.1 Sprout, 0.5 Glow, 1 Royal. Every solve climbs a global leaderboard rebuilt from chain events.",
  icon: "heart",
  category: "game",
  shell: "game",

  gamePage: {
    categoryColor: "#14B8A6",
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
        gradient: "linear-gradient(135deg, #F0FDFA 0%, #99F6E4 44%, #14B8A6 100%)",
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
          hidden: true,
          required: true,
          default: "0",
          options: [
            { value: "0", label: "Sprout Hatch — win 0.1 GAS" },
            { value: "1", label: "Glow Garden — win 0.5 GAS" },
            { value: "2", label: "Royal Bloom — win 1 GAS" },
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
