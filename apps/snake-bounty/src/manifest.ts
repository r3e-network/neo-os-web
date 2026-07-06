import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Snake Bounty",
  description:
    "Timed on-chain Snake with provably fair deals. Pick a bounty trail, grow your snake to the route target on a TEE-seeded grid before the deadline, and win a fixed GAS reward — 0.1 Garden, 0.5 Market, 1 Apex. Every move is tracked by the enclave; collide with a wall or yourself and it's game over. Each solve climbs a global leaderboard rebuilt from chain events.",
  icon: "activity",
  category: "game",
  shell: "game",

  gamePage: {
    // Matches the app's --mx2-brand override (src/PlayArea.scss); the splash
    // shell injects this as its --n3h-accent inline, so it must be the same
    // jade the in-game shell renders.
    categoryColor: "#00af92",
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
        // Jade ramp built from the app's brand-light/subtle/brand values so the
        // splash feature card reads in the same green family as the CTA.
        gradient: "linear-gradient(135deg, #e4f8f2 0%, #bdeadf 46%, #00af92 100%)",
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
            { value: "0", label: "Garden Trail — win 0.1 GAS" },
            { value: "1", label: "Market Trail — win 0.5 GAS" },
            { value: "2", label: "Apex Trail — win 1 GAS" },
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
