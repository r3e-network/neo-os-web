import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

const manifest: MiniAppManifest = {
  name: "Sheep Solitaire",
  description:
    "A bright Phaser match-3 game with a layered meadow board, a seven-slot tray, tactile tile movement, animated dealing and elimination, three useful recovery tools, three timed routes, and exact refresh recovery. Free play is local and never opens a wallet prompt.",
  icon: "layers",
  category: "game",
  shell: "game",
  // Keep new paid sessions hidden at the launcher until the deployed TEE,
  // contract and end-to-end settlement flow have current production evidence.
  // Historical GameFi sessions remain recoverable in main.tsx.
  supportsGuest: true,
  supportsGameFi: false,

  gamePage: {
    categoryColor: "#84CC16",
    modes: { guest: true, gamefi: false },
    heroBadgeKey: "guestBadge",
    heroTitleKey: "appEyebrow",
    heroTitleAccent: "appEyebrow",
    heroDescKey: "appSubtitle",
    primaryLabelKey: "startAction",
    ghostLabelKey: "rulesTitle",
    featuresEyebrowKey: "guestBadge",
    featuresTitleKey: "boardTagline",
    features: [
      {
        titleKey: "boardTagline",
        descKey: "appSubtitle",
        large: true,
        gradient: "linear-gradient(135deg, #F7FEE7 0%, #BEF264 46%, #84CC16 100%)",
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
    trustBadgeKeys: ["guestBadge", "boardTagline", "difficultyTitle"],
  },

  tabs: [
    { key: "play", labelKey: "playTab", icon: "layers", default: true },
    { key: "ranks", labelKey: "ranksTab", icon: "award" },
  ],

  stats: [
    { labelKey: "scoreWon", valueKey: "myTotalWon", format: "text", variant: "success", icon: "trophy" },
    { labelKey: "scoreRuns", valueKey: "mySolves", format: "text", icon: "layers" },
  ],

  sidebar: {
    titleKey: "sidebarTitle",
    items: [
      { labelKey: "scoreWon", valueKey: "myTotalWon", format: "text" },
      { labelKey: "scoreRuns", valueKey: "mySolves", format: "text" },
    ],
  },

  // Paid operations remain implemented for recovery/hardening, but are not
  // published until the live TEE deal and settlement schemas are aligned.
  operations: [],

  docs: [
    { titleKey: "rulesTitle", contentKey: "rulesCopy", type: "steps" },
    { titleKey: "fairnessTitle", contentKey: "fairnessCopy", type: "text" },
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

export default manifest;
