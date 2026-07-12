/**
 * On-Chain Tarot Manifest
 *
 * Declarative configuration for the blockchain-powered tarot reading miniapp.
 * Provides the animated three-card reading surface. GameFi stays gated until
 * its randomness contract is migrated to the advertised VRF settlement path.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  // -- Identity ---------------------------------------------------------------
  name: "On-Chain Tarot",
  description: "Animated local three-card tarot ritual with no wallet or GAS at risk",
  icon: "star",
  category: "game",
  // Game shell → focused two-choice launch page (the two-mode guest entry is
  // rendered only for shell "game"). Matches every other guest-enabled game
  // (color-clash, fogplay, dice-game, ...).
  shell: "game",
  // The selected ritual-table design is itself the launch experience. Avoid
  // placing the generic banner/card chooser in front of the playable objects.
  directPlay: true,

  // Two-mode launcher entry: primary "Earn GAS" (GameFi, unchanged) + secondary
  // "Play free" (Guest — a purely local tarot reading). On-Chain Tarot has no
  // gamePage block, so it opts in via the top-level supportsGuest flag.
  supportsGuest: true,
  // Production gate: the asynchronous MiniAppTarotVrf contract and frontend
  // flow are built, but the replacement is not deployed/allowlisted/funded and
  // the published .miniapp.neo domain still points at a legacy ABI. Keep the
  // complete guest ritual playable until the live wallet settlement matrix and
  // exact manifest/domain binding pass on testnet.
  supportsGameFi: false,

  // -- Tabs -------------------------------------------------------------------
  tabs: [
    { key: "game", labelKey: "drawYourCards", icon: "star", default: true },
    { key: "stats", labelKey: "stats", icon: "bar-chart" },
  ],

  // -- Stats ------------------------------------------------------------------
  stats: [
    { labelKey: "readings", valueKey: "readingsCount", format: "number", icon: "book" },
    { labelKey: "cardsDrawnCount", valueKey: "cardsDrawnCount", format: "number", icon: "layers" },
    { labelKey: "allRevealed", valueKey: "allRevealedDisplay", format: "text", icon: "eye" },
  ],

  // -- Sidebar ----------------------------------------------------------------
  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "readings", valueKey: "readingsCount", format: "number" },
      { labelKey: "cardsDrawnCount", valueKey: "cardsDrawnCount", format: "number" },
      { labelKey: "allRevealed", valueKey: "allRevealedDisplay", format: "text" },
    ],
  },

  // -- Features ---------------------------------------------------------------
  features: {
    walletRequired: false,
    chainWarning: false,
  },

  // -- Docs -------------------------------------------------------------------
  docs: [
    { titleKey: "guestVerificationTitle", contentKey: "guestReadingIntentCopy", type: "text" },
    { titleKey: "readingFlowTitle", contentKey: "guestFairnessCopy", type: "text" },
  ],

  // -- Permissions ------------------------------------------------------------
  permissions: {
    payments: false,
    randomness: false,
  },
};
