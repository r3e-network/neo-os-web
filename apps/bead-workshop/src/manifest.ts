import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Bead Workshop",
  description:
    "A bright tactile Phaser bead puzzle with 140-piece certified boards, connected-patch movement, a 14-slot tray, expressive animation, full recovery, and no wallet or chain dependency.",
  icon: "sparkles",
  category: "game",
  shell: "game",
  supportsGuest: true,
  supportsGameFi: false,
  gamePage: {
    categoryColor: "#FF745C",
    modes: { guest: true, gamefi: false },
    heroBadgeKey: "localOnly",
    heroTitleKey: "appTitle",
    heroTitleAccent: "appTitle",
    heroDescKey: "appSubtitle",
    primaryLabelKey: "startAction",
    ghostLabelKey: "rulesTitle",
    featuresEyebrowKey: "appEyebrow",
    featuresTitleKey: "featureBoardTitle",
    features: [
      {
        titleKey: "featureBoardTitle",
        descKey: "featureBoardCopy",
        large: true,
        gradient:
          "linear-gradient(135deg, #FFF9E8 0%, #FFD38B 48%, #FF7C62 100%)",
      },
      { titleKey: "featureRecoveryTitle", descKey: "featureRecoveryCopy" },
      { titleKey: "featureInputTitle", descKey: "featureInputCopy" },
    ],
    ctaTitleKey: "appTitle",
    ctaDescKey: "appSubtitle",
    ctaLabelKey: "startAction",
    trustBadgeKeys: ["localOnly", "fairnessTitle", "featureInputTitle"],
  },
  tabs: [{ key: "play", labelKey: "playTab", icon: "grid", default: true }],
  stats: [],
  sidebar: { titleKey: "rulesTitle", items: [] },
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
    oracle: false,
  },
};
