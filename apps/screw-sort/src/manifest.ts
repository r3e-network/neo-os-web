import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Screw Sort",
  description:
    "A warm local screw-sorting puzzle with layered planks, tactile material art, seeded solvable levels, five-slot overflow pressure, undo, pause, restart, and recovery.",
  icon: "wrench",
  category: "game",
  shell: "game",
  directPlay: true,
  supportsGuest: true,
  supportsGameFi: false,
  theme: { family: "gaming", accentColor: "#d76a35", density: "comfortable" },

  gamePage: {
    categoryColor: "#D76A35",
    modes: { guest: true, gamefi: false },
    heroBadgeKey: "networkBadge",
    heroTitleKey: "appEyebrow",
    heroTitleAccent: "appEyebrow",
    heroDescKey: "appSubtitle",
    primaryLabelKey: "startAction",
    ghostLabelKey: "rulesTitle",
    featuresTitleKey: "fairnessTitle",
    features: [
      {
        titleKey: "fairnessTitle",
        descKey: "fairnessCopy",
        large: true,
        gradient: "linear-gradient(135deg, #FFF9EE 0%, #F5D4A4 48%, #D76A35 100%)",
      },
      { titleKey: "rulesTitle", descKey: "rulesCopy" },
    ],
    ctaTitleKey: "lobbyTitle",
    ctaDescKey: "appSubtitle",
    ctaLabelKey: "startAction",
    trustBadgeKeys: ["networkBadge", "fairnessTitle"],
  },

  tabs: [{ key: "play", labelKey: "playTab", icon: "wrench", default: true }],
  stats: [],
  operations: [],
  docs: [
    { titleKey: "rulesTitle", contentKey: "rulesCopy", type: "steps" },
    { titleKey: "fairnessTitle", contentKey: "fairnessCopy", type: "text" },
  ],
  features: {
    walletRequired: false,
    chainWarning: false,
    fireworks: true,
    activityFeed: false,
    reviews: true,
    comments: true,
  },
  permissions: {
    payments: false,
    randomness: false,
    compute: false,
    confidential: false,
    oracle: false,
  },
};
