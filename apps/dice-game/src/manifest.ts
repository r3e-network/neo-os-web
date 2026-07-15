import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Dice Game",
  description: "Pick a face, stack a practice chip, and enjoy a polished local dice table with animated throws.",
  icon: "dice",
  category: "game",
  shell: "game",

  // Two-mode opt-in (dice-game has no full gamePage block, so use the top-level
  // flag). GUEST = a purely local dice table (crypto-RNG rolls, no wallet/chain).
  // GameFi is fail-closed until the configured Neo N3 deployments are replaced
  // with bytecode that matches the audited fixed-beacon contract artifact. Keep
  // the local table playable without exposing a wallet-funded roll meanwhile.
  supportsGuest: true,
  supportsGameFi: false,

  gamePage: {
    categoryColor: "#14B8A6",
    appIcon: "dice",
    modes: { guest: true, gamefi: false },
    heroBadgeKey: "guestBadge",
    heroTitleKey: "appTitle",
    heroTitleAccent: "appTitle",
    heroDescKey: "guestSubtitle",
    primaryLabelKey: "startAction",
    ghostLabelKey: "rulesTitle",
    featuresEyebrowKey: "guestBadge",
    featuresTitleKey: "howItWorks",
    features: [
      {
        titleKey: "guestRulesTitle",
        descKey: "guestHowItWorksBody",
        large: true,
        gradient: "linear-gradient(135deg, #FFFBEB 0%, #99F6E4 48%, #5EEAD4 100%)",
      },
      { titleKey: "guestFairnessTitle", descKey: "guestSafetyBody" },
      { titleKey: "guestPayoutTitle", descKey: "guestRiskBody" },
    ],
    lbEyebrowKey: "guestBadge",
    lbTitleKey: "ranksTab",
    lbScoreLabelKey: "payoutMetric",
    ctaTitleKey: "appTitle",
    ctaDescKey: "guestRulesShort",
    ctaLabelKey: "startAction",
    // Trust badges are selling points. "GameFi validation in progress" sat in
    // the middle slot and was a pure staleness signal — a store-facing chip
    // telling a first-time visitor the product was mid-repair before they had
    // touched it. A guest-only build ships one complete mode; state what the
    // visitor gets instead.
    trustBadgeKeys: ["guestBadge", "guestFairnessTitle", "guestPayoutTitle"],
  },

  tabs: [
    { key: "roll", labelKey: "rollTab", icon: "dice", default: true },
    { key: "rules", labelKey: "rulesTab", icon: "shield" },
  ],

  stats: [
    { labelKey: "selectedFace", valueKey: "selectedFace", format: "text", variant: "accent", icon: "hash" },
    { labelKey: "stakeAmount", valueKey: "stakeAmount", format: "text", icon: "coin" },
    { labelKey: "payoutPreview", valueKey: "payoutPreview", format: "text", variant: "success", icon: "trophy" },
  ],

  sidebar: {
    titleKey: "rollSummary",
    items: [
      { labelKey: "selectedFace", valueKey: "selectedFace", format: "text" },
      { labelKey: "stakeAmount", valueKey: "stakeAmount", format: "text" },
      { labelKey: "payoutPreview", valueKey: "payoutPreview", format: "text" },
    ],
  },

  // The Phaser table owns face selection, chips, throw animation and recovery.
  // Do not render a second questionnaire-style operation form around the game.
  operations: [],

  docs: [
    { titleKey: "howItWorks", contentKey: "docHowItWorks", type: "steps" },
    { titleKey: "safetyModel", contentKey: "docSafetyModel", type: "text" },
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
  },

  contract: {
    mode: "custom",
  },
};
