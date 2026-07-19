import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Jump Rush",
  // Store-facing description: what ships, not what is gated. The trailing
  // "reward lane stays gated until its deployed contract and Morpheus session
  // protocol pass end-to-end production validation" put release-engineering
  // status into store metadata.
  description:
    "A polished Phaser platform-jumping game with illustrated bunny, carrot, cloud, and grass-platform artwork; tactile hold-and-release controls; three route lengths; recovery after a missed landing; and free local play. No wallet, fee, or chain write is involved.",
  icon: "zap",
  category: "game",
  shell: "game",
  supportsGuest: true,
  supportsGameFi: false,

  gamePage: {
    categoryColor: "#38BDF8",
    modes: { guest: true, gamefi: false },
    heroBadgeKey: "guestModeValue",
    heroTitleKey: "appEyebrow",
    heroTitleAccent: "appEyebrow",
    heroDescKey: "guestSubtitle",
    primaryLabelKey: "startAction",
    ghostLabelKey: "rulesTitle",
    featuresEyebrowKey: "guestModeValue",
    featuresTitleKey: "gameplayFeatureTitle",
    features: [
      {
        titleKey: "gameplayFeatureTitle",
        descKey: "gameplayFeatureCopy",
        large: true,
        gradient: "linear-gradient(135deg, #F0F9FF 0%, #BAE6FD 46%, #38BDF8 100%)",
      },
      { titleKey: "difficultyTitle", descKey: "guestStartDescription" },
      { titleKey: "leaderboardTitle", descKey: "guestLeaderboardIntro" },
    ],
    lbEyebrowKey: "ranksTab",
    lbTitleKey: "leaderboardTitle",
    lbScoreLabelKey: "guestBestLabel",
    ctaTitleKey: "lobbyTitle",
    ctaDescKey: "guestStartDescription",
    ctaLabelKey: "startAction",
    // Distinct from heroBadgeKey (guestModeValue) and featuresTitleKey
    // (gameplayFeatureTitle) — reusing those rendered "Local" three times and
    // "A real platform-jumping game" twice on the same launcher.
    trustBadgeKeys: ["controlBadge", "recoveryBadge", "rankLabel"],
  },

  tabs: [
    { key: "play", labelKey: "playTab", icon: "zap", default: true },
    { key: "ranks", labelKey: "ranksTab", icon: "award" },
  ],

  // These bind straight into shell chrome that MiniAppRoot renders with no
  // loading gate of its own, so each declares `pendingKey`: until a leaderboard
  // or profile read settles the bound observable holds `undefined`, and the
  // chrome says "Reading…" instead of publishing a fabricated "0". A settled 0
  // is a real reading (a player with 0 runs) and still renders as 0. `myRank`
  // binds `myRankDisplay` so an unranked player reads as a word, never rank 0.
  // See main.tsx.
  stats: [
    { labelKey: "guestBestLabel", valueKey: "myTotalWon", format: "text", variant: "success", icon: "trophy", pendingKey: "statAwaitingRead" },
    { labelKey: "guestRunsLabel", valueKey: "myRuns", format: "text", icon: "zap", pendingKey: "statAwaitingRead" },
    { labelKey: "myRank", valueKey: "myRankDisplay", format: "text", variant: "accent", icon: "award", pendingKey: "statAwaitingRead" },
  ],

  sidebar: {
    titleKey: "sidebarTitle",
    items: [
      { labelKey: "guestBestLabel", valueKey: "myTotalWon", format: "text", pendingKey: "statAwaitingRead" },
      { labelKey: "rankLabel", valueKey: "myRankDisplay", format: "text", pendingKey: "statAwaitingRead" },
      { labelKey: "guestRunsLabel", valueKey: "myRuns", format: "text", pendingKey: "statAwaitingRead" },
    ],
  },

  // Paid operations remain implemented for testnet hardening, but the public
  // release is deliberately fail-closed until the live TEE/contract schemas
  // and timing rules are aligned and an end-to-end settlement passes.
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

  contract: {
    mode: "shared",
    moduleId: "platform-game",
    registry: "0x5ec036efaa1fbde3ff7d1587d790768bc098cb2b",
    engine: "0xc75b181b4561462903bb27d8d9e0b32b637bec12",
  },
};
