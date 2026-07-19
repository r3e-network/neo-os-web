import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Aim Master",
  description:
    "Free local target practice: choose a lane, fire anywhere on the range as the moving reticle crosses the bullseye, and chain clean hits before time runs out. No wallet or GAS is required, and best scores are saved on your device.",
  icon: "crosshair",
  category: "game",
  shell: "game",
  supportsGuest: true,
  supportsGameFi: false,

  gamePage: {
    categoryColor: "#F97316",
    modes: { guest: true, gamefi: false },
    heroBadgeKey: "guestModeValue",
    heroTitleKey: "appEyebrow",
    heroTitleAccent: "appEyebrow",
    heroDescKey: "guestSubtitle",
    primaryLabelKey: "startAction",
    ghostLabelKey: "rulesTitle",
    // "Local run" is already the hero badge; reusing it here printed the same
    // two words a third time (badge, chip, details hint) on one screen.
    featuresEyebrowKey: "guestOffChainBadge",
    featuresTitleKey: "guestRulesTitle",
    features: [
      {
        titleKey: "guestRulesTitle",
        descKey: "guestRulesCopy",
        large: true,
        gradient: "linear-gradient(135deg, #FFF7ED 0%, #FDBA74 46%, #FB923C 100%)",
      },
      { titleKey: "difficultyTitle", descKey: "startDescription" },
      { titleKey: "leaderboardTitle", descKey: "leaderboardIntro" },
    ],
    lbEyebrowKey: "ranksTab",
    lbTitleKey: "leaderboardTitle",
    lbScoreLabelKey: "guestBestLabel",
    ctaTitleKey: "lobbyTitle",
    ctaDescKey: "guestRulesCopy",
    ctaLabelKey: "startAction",
    // Trust badges are selling points. The maintenance sentence that used to sit
    // in the middle slot leaked release-engineering detail onto the first screen
    // a visitor ever sees; "Local run" duplicated the hero badge beside it.
    trustBadgeKeys: ["guestEntryLabel", "guestOffChainBadge", "rankLabel"],
  },

  tabs: [
    { key: "play", labelKey: "playTab", icon: "target", default: true },
    { key: "ranks", labelKey: "ranksTab", icon: "award" },
  ],

  stats: [
    { labelKey: "guestBestLabel", valueKey: "myTotalWon", format: "text", variant: "success", icon: "trophy" },
    { labelKey: "rankLabel", valueKey: "myRank", format: "text", variant: "accent", icon: "award" },
  ],

  sidebar: {
    titleKey: "sidebarTitle",
    items: [
      { labelKey: "guestBestLabel", valueKey: "myTotalWon", format: "text" },
      { labelKey: "rankLabel", valueKey: "myRank", format: "text" },
    ],
  },

  operations: [],

  docs: [
    { titleKey: "guestRulesTitle", contentKey: "guestRulesCopy", type: "steps" },
    // Was titleKey === contentKey, which printed the same sentence as its own
    // heading. The gate is real, so it keeps a doc entry — with a real title.
    { titleKey: "gameFiModeDocTitle", contentKey: "gameFiMaintenanceShort", type: "text" },
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
