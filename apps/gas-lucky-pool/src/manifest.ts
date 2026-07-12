import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "OneGate Vault",
  description: "A free local lucky-draw game with three reward tiers, animated prize reveals, and a local leaderboard. No wallet or GAS is required while verified GameFi settlement remains under validation.",
  icon: "gift",
  category: "game",
  shell: "game",
  theme: { family: "gaming", accentColor: "#D97706", density: "comfortable" },
  supportsGuest: true,
  // The configured mainnet/testnet addresses currently expose the Red Envelope
  // ABI rather than RangeGasPool. Keep the local draw playable, but do not
  // expose wallet/owner operations until a verified pool deployment is bound.
  supportsGameFi: false,

  // Keep the shared launch screen on the same locale-driven, guest-first
  // contract as the actual Phaser scene. Falling back to the English manifest
  // identity made the Chinese launcher look half translated and falsely
  // emphasized wallet semantics for a local-only release.
  gamePage: {
    categoryColor: "#F59E0B",
    appIcon: "gift",
    modes: { guest: true, gamefi: false },
    heroBadgeKey: "guestEyebrow",
    heroTitleKey: "guestTitle",
    heroTitleAccent: "guestTitle",
    heroDescKey: "guestSubtitle",
    primaryLabelKey: "guestActionDraw",
    ghostLabelKey: "guestHowTitle",
    featuresEyebrowKey: "guestModeBadge",
    featuresTitleKey: "guestDrawerTitle",
    features: [
      {
        titleKey: "guestHowTitle",
        descKey: "guestHowBody",
        large: true,
        gradient: "linear-gradient(135deg, #FFFBEB 0%, #FDE68A 46%, #FDBA74 100%)",
      },
      { titleKey: "guestSeedNote", descKey: "guestSeedNote" },
      { titleKey: "guestBoardTitle", descKey: "guestBoardEmpty" },
    ],
    lbEyebrowKey: "guestTabDraw",
    lbTitleKey: "guestBoardTitle",
    lbScoreLabelKey: "guestBestLabel",
    ctaTitleKey: "guestUnwrapTitle",
    ctaDescKey: "guestTagline",
    ctaLabelKey: "guestActionDraw",
    trustBadgeKeys: ["guestModeBadge", "gameFiMaintenanceShort", "guestBoardTitle"],
  },

  tabs: [
    { key: "play", labelKey: "playTab", icon: "gift", default: true },
    { key: "activity", labelKey: "activityTab", icon: "history" },
  ],

  operations: [],

  docs: [
    { titleKey: "guestHowTitle", contentKey: "guestHowBody", type: "steps" },
    { titleKey: "gameFiMaintenanceShort", contentKey: "gameFiMaintenanceBody", type: "text" },
  ],

  features: {
    fireworks: true,
    walletRequired: false,
    chainWarning: false,
    comments: true,
    reviews: true,
    activityFeed: true,
  },

  permissions: {
    payments: false,
    randomness: false,
    compute: false,
    oracle: false,
  },
};
