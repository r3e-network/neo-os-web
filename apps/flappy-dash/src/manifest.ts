import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Flappy Dash",
  // Store-facing description: what ships, not what is gated. The trailing
  // "reward route stays gated until Morpheus replay and deployed settlement
  // timing pass production validation" put release-engineering status into
  // store metadata.
  description:
    "A polished Flappy-style arcade challenge with real bird and pipe artwork, responsive controls, sound, three distinct difficulty curves, instant restarts, and free local practice. No wallet, fee, or chain write is involved.",
  icon: "cloud",
  category: "game",
  shell: "game",
  supportsGuest: true,
  supportsGameFi: false,

  // ── Steam-style Game Landing Page ──────────────────────────────────
  gamePage: {
    categoryColor: "#10B981",
    modes: { guest: true, gamefi: false },
    heroBadgeKey: "homeBadge",
    heroTitleKey: "homeTitle",
    heroTitleAccent: "homeTitleAccent",
    heroDescKey: "homeDesc",
    primaryLabelKey: "startAction",
    ghostLabelKey: "homeHowToPlay",
    featuresEyebrowKey: "homeBadge",
    featuresTitleKey: "homeFeatureFlightFeel",
    features: [
      {
        titleKey: "homeFeatureFlightFeel", descKey: "homeFeatureFlightFeelDesc",
        large: true,
        gradient: "linear-gradient(135deg, #064E3B 0%, #059669 40%, #10B981 100%)",
      },
      { titleKey: "homeFeatureDifficulty", descKey: "homeFeatureDifficultyDesc" },
      { titleKey: "homeFeatureRank", descKey: "homeFeatureRankDesc" },
    ],
    lbEyebrowKey: "homeLbEyebrow",
    lbTitleKey: "homeLbTitle",
    lbScoreLabelKey: "homeLbScoreLabel",
    ctaTitleKey: "homeCtaTitle",
    ctaDescKey: "homeCtaDesc",
    ctaLabelKey: "homeCtaLabel",
    trustBadgeKeys: ["homeTrustBadge1", "homeTrustBadge2", "homeTrustBadge3"],
  },

  tabs: [
    { key: "play", labelKey: "playTab", icon: "airplay", default: true },
    { key: "ranks", labelKey: "ranksTab", icon: "award" },
  ],

  stats: [
    { labelKey: "guestBestLabel", valueKey: "myTotalWon", format: "text", variant: "success", icon: "trophy" },
    { labelKey: "homeSolvesStat", valueKey: "mySolves", format: "text", icon: "check-circle" },
    { labelKey: "homeRankStat", valueKey: "myRank", format: "text", variant: "accent", icon: "award" },
  ],

  sidebar: {
    titleKey: "sidebarTitle",
    items: [
      { labelKey: "guestBestLabel", valueKey: "myTotalWon", format: "text" },
      { labelKey: "rankLabel", valueKey: "myRank", format: "text" },
      { labelKey: "homeSolvesStat", valueKey: "mySolves", format: "text" },
    ],
  },

  // The reward implementation remains in source for testnet validation, but
  // no stale host should be able to render a wallet/payment operation while
  // the published GameFi lane is intentionally gated.
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
