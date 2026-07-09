import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Catch the Goose",
  description:
    "A free, physics-driven find-and-clear game. Items tumble into the pen; tap to pull them into your 7-slot tray, match three of a kind to clear, empty the pen, and snatch the runaway goose before time runs out. Fifteen levels of rising clutter, all played locally with no entry fee.",
  icon: "bird",
  category: "game",
  shell: "game",

  gamePage: {
    categoryColor: "#F59E0B",
    modes: { guest: true },
    heroBadgeKey: "guestRunValue",
    heroTitleKey: "appEyebrow",
    heroTitleAccent: "appEyebrow",
    heroDescKey: "appSubtitle",
    primaryLabelKey: "startAction",
    ghostLabelKey: "rulesTitle",
    featuresEyebrowKey: "guestRunValue",
    featuresTitleKey: "rulesTitle",
    features: [
      {
        titleKey: "rulesTitle",
        descKey: "rulesCopy",
        large: true,
        gradient: "linear-gradient(135deg, #FEF3C7 0%, #FCD34D 44%, #F59E0B 100%)",
      },
    ],
    ctaTitleKey: "lobbyTitle",
    ctaDescKey: "startDescription",
    ctaLabelKey: "startAction",
    trustBadgeKeys: ["guestRunValue", "scoreLevel", "creditLabel"],
  },

  tabs: [
    { key: "play", labelKey: "playTab", icon: "grid", default: true },
  ],

  stats: [
    { labelKey: "scoreWon", valueKey: "myTotalWon", format: "text", variant: "success", icon: "trophy" },
    { labelKey: "scoreLevel", valueKey: "gameDifficulty", format: "text", variant: "accent", icon: "layers" },
    { labelKey: "creditLabel", valueKey: "mySolves", format: "text", icon: "check" },
  ],

  sidebar: {
    titleKey: "sidebarTitle",
    items: [
      { labelKey: "scoreWon", valueKey: "myTotalWon", format: "text" },
      { labelKey: "scoreLevel", valueKey: "gameDifficulty", format: "text" },
      { labelKey: "creditLabel", valueKey: "mySolves", format: "text" },
    ],
  },

  operations: [],

  docs: [
    { titleKey: "rulesTitle", contentKey: "rulesCopy", type: "steps" },
  ],

  features: {
    walletRequired: false,
    chainWarning: false,
    fireworks: true,
    activityFeed: false,
    reviews: true,
    comments: true,
  },

  permissions: {},

  contract: {
    mode: "none",
  },
};
