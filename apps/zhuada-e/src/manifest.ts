import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Catch the Goose",
  description:
    "A free, physics-driven find-and-clear game. Items tumble into the pen; tap to pull them into your 7-slot tray, match three of a kind to clear, empty the pen, and snatch the runaway goose before time runs out. Fifteen levels across six themed scenes — clear a scene to collect its limited-edition goose. All played locally with no entry fee.",
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

  // Stats bind LOCALLY-derived observables (statWins/statBest/statCleared/
  // statGeese, fed from the persisted guest progress) — the chain-fed
  // mySolves/myTotalWon stay 0 in this guest-only app and would read dead.
  stats: [
    { labelKey: "statBest", valueKey: "statBest", format: "text", variant: "success", icon: "trophy" },
    { labelKey: "creditLabel", valueKey: "statCleared", format: "text", variant: "accent", icon: "layers" },
    { labelKey: "statGeese", valueKey: "statGeese", format: "text", icon: "check" },
  ],

  sidebar: {
    titleKey: "sidebarTitle",
    items: [
      { labelKey: "statBest", valueKey: "statBest", format: "text" },
      { labelKey: "statWins", valueKey: "statWins", format: "text" },
      { labelKey: "creditLabel", valueKey: "statCleared", format: "text" },
      { labelKey: "statGeese", valueKey: "statGeese", format: "text" },
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

  // Guest-only miniapp: no contract binding (the field is optional and
  // "none" is not a valid ContractMode).
};
