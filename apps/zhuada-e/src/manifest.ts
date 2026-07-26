import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

const simulatorQaDirectPlay =
  import.meta.env.DEV &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("simQa") === "1";

export const manifest: MiniAppManifest = {
  name: "Goose Basket Shuffle",
  description:
    "An original physics-driven find-and-clear game with three complete player-selectable themes. Pull objects into a 7-slot tray, match three of a kind, shake the real phone to turn the basket, and clear twenty-four levels. Relaxed play is untimed by default, timed challenge is optional, and personal progress stays on this device.",
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
    // GameHomePage renders this as the collapsed detail panel's hint next to
    // the "How to play" title. It pointed at `guestRunValue`, so the panel
    // read "How to play / Free" — the third printing of "Free" on one screen
    // (eyebrow badge + shared guest-only subtitle tail) and a hint that says
    // nothing about what the panel opens into. `startHint` previews the
    // actual rule and stays inside GameHomePage's 56-char shortHint budget.
    // The launcher already opens `docs[type=steps]` as the dedicated rules
    // preview. Keep this lower showcase about the three complete art
    // directions instead of printing the same long rules copy a second time.
    featuresEyebrowKey: "trustThemesBadge",
    featuresTitleKey: "themePickerTitle",
    features: [
      {
        titleKey: "themeFreshName",
        descKey: "themeFreshDescription",
        large: true,
        gradient: "linear-gradient(135deg, #F1F5D9 0%, #B9D88D 48%, #5B9B68 100%)",
      },
      {
        titleKey: "themeFarmName",
        descKey: "themeFarmDescription",
        gradient: "linear-gradient(135deg, #FFF0D2 0%, #E7AE68 52%, #A8472F 100%)",
      },
      {
        titleKey: "themeNightName",
        descKey: "themeNightDescription",
        gradient: "linear-gradient(135deg, #252A49 0%, #573A66 52%, #F2B640 100%)",
      },
    ],
    ctaTitleKey: "lobbyTitle",
    ctaDescKey: "startDescription",
    ctaLabelKey: "startAction",
    trustBadgeKeys: ["trustUntimedBadge", "trustThemesBadge", "trustLocalProgressBadge"],
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
