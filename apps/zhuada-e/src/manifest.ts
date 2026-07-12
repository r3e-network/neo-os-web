import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

const simulatorQaDirectPlay =
  import.meta.env.DEV &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("simQa") === "1";

export const manifest: MiniAppManifest = {
  name: "Goose Basket Shuffle",
  description:
    "An original physics-driven find-and-clear game with three complete player-selectable themes. Pull objects into a 7-slot tray, match three of a kind, shake the real phone to turn the basket, and clear fifteen levels. Relaxed play is untimed by default, timed challenge is optional, and personal progress stays on this device.",
  icon: "bird",
  category: "game",
  shell: "game",
  directPlay: simulatorQaDirectPlay,

  gamePage: {
    categoryColor: "#F59E0B",
    modes: { guest: true, gamefi: false },
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
