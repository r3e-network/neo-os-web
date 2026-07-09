import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Jump Rush",
  description:
    "Timed on-chain jumping game with provably fair platform layouts. Choose a route, hold to charge, and release to jump to the next platform. Perfect center landings score bonus points. Missing the platform ends the run. Pay a small entry, conquer the route before the deadline, and win a fixed GAS reward — 0.1 Meadow, 0.5 Cloud, 1 Summit. Every run is verified inside the TEE enclave.",
  icon: "zap",
  category: "game",
  shell: "game",

  gamePage: {
    categoryColor: "#38BDF8",
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
        gradient: "linear-gradient(135deg, #F0F9FF 0%, #BAE6FD 46%, #38BDF8 100%)",
      },
      { titleKey: "difficultyTitle", descKey: "startDescription" },
      { titleKey: "leaderboardTitle", descKey: "leaderboardIntro" },
    ],
    lbEyebrowKey: "ranksTab",
    lbTitleKey: "leaderboardTitle",
    lbScoreLabelKey: "myTotalWon",
    ctaTitleKey: "lobbyTitle",
    ctaDescKey: "startDescription",
    ctaLabelKey: "startAction",
    trustBadgeKeys: ["networkBadge", "fairnessTitle", "rankLabel"],
  },

  tabs: [
    { key: "play", labelKey: "playTab", icon: "zap", default: true },
    { key: "ranks", labelKey: "ranksTab", icon: "award" },
  ],

  stats: [
    { labelKey: "lastPayout", valueKey: "lastPayout", format: "text", variant: "success", icon: "trophy" },
    { labelKey: "myTotalWon", valueKey: "myTotalWon", format: "text", icon: "coin" },
    { labelKey: "myRank", valueKey: "myRank", format: "text", variant: "accent", icon: "award" },
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
            { value: "0", label: "Meadow Hop — win 0.1 GAS" },
            { value: "1", label: "Cloud Dash — win 0.5 GAS" },
            { value: "2", label: "Summit Leap — win 1 GAS" },
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
