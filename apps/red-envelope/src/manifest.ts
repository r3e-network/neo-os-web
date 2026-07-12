/**
 * Red Envelope Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the red-envelope miniapp except the play area.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  // -- Identity ---------------------------------------------------------------
  name: "Red Envelope",
  description:
    "Open low-stakes GAS lucky packets from public network-bound links on Neo N3",
  icon: "gift",
  category: "social",
  // `shell: "game"` renders the two-choice launcher entry (Earn GAS / Play free);
  // because this manifest has `operations`, the host template still resolves to
  // its two-column layout, so the gamefi surface is unchanged — the launcher just
  // adds the guest/gamefi choice in front.
  shell: "game",
  // Two-mode opt-in. No full gamePage block, so opt in via the top-level flag —
  // GUEST is a purely local packet game (see logic/guest-engine.ts); GAMEFI is the
  // existing on-chain create/claim flow, unchanged.
  supportsGuest: true,
  // The v1.1 TestNet deployment has a completed two-wallet deposit -> create ->
  // claim -> claim proof. Keep the flag explicit so a release can fail closed by
  // flipping one value; main.tsx independently guards every new paid action.
  supportsGameFi: true,

  // The shared game launcher must use the same locale-driven red-envelope
  // language as the Phaser table. Without this block it falls back to the raw
  // English manifest identity even when the rest of the miniapp is Chinese.
  gamePage: {
    categoryColor: "#E5484D",
    appIcon: "gift",
    modes: { guest: true, gamefi: true },
    heroBadgeKey: "appEyebrow",
    heroTitleKey: "appTitle",
    heroTitleAccent: "appTitle",
    heroDescKey: "appSubtitle",
    primaryLabelKey: "claimRedEnvelope",
    featuresEyebrowKey: "shareReadyTitle",
    featuresTitleKey: "claimFlowTitle",
    features: [
      {
        titleKey: "claimPanelTitle",
        descKey: "claimRouteOneCopy",
        large: true,
        gradient: "linear-gradient(135deg, #FFF7ED 0%, #FECACA 46%, #FB7185 100%)",
      },
      { titleKey: "createPanelTitle", descKey: "perPacketRandomNote" },
      { titleKey: "safetyPanelTitle", descKey: "safetyPanelCopy" },
    ],
    lbEyebrowKey: "guestBadge",
    lbTitleKey: "guestBoardTitle",
    lbScoreLabelKey: "guestBestLabel",
    ctaTitleKey: "redEnvelopeHeroTitle",
    ctaDescKey: "redEnvelopeHeroSubtitle",
    ctaLabelKey: "claimRedEnvelope",
    trustBadgeKeys: ["osGuarded", "guestBadge", "shareReadyTitle"],
  },

  // -- Tabs -------------------------------------------------------------------
  tabs: [
    { key: "claim", labelKey: "claimTabLabel", icon: "target", default: true },
    { key: "create", labelKey: "createTab", icon: "gift" },
    { key: "myEnvelopes", labelKey: "myEnvelopes", icon: "archive" },
  ],

  // -- Stats Grid -------------------------------------------------------------
  stats: [
    {
      labelKey: "sidebarEnvelopes",
      valueKey: "envelopeCount",
      format: "number",
      variant: "danger",
      icon: "gift",
    },
    {
      labelKey: "sidebarClaims",
      valueKey: "claimCount",
      format: "number",
      variant: "accent",
      icon: "check-circle",
    },
    {
      labelKey: "sidebarPools",
      valueKey: "poolCount",
      format: "number",
      icon: "users",
    },
  ],

  // -- Sidebar ----------------------------------------------------------------
  sidebar: {
    titleKey: "title",
    items: [
      {
        labelKey: "sidebarEnvelopes",
        valueKey: "envelopeCount",
        format: "number",
      },
      { labelKey: "sidebarClaims", valueKey: "claimCount", format: "number" },
      { labelKey: "sidebarPools", valueKey: "poolCount", format: "number" },
    ],
  },

  // The Phaser scene owns the complete recipient and creator interaction. Do
  // not render a second questionnaire-style operation panel around the game.
  operations: [],

  // -- Features ---------------------------------------------------------------
  features: {
    fireworks: true,
    walletRequired: true,
    chainWarning: true,
  },

  // -- Docs -------------------------------------------------------------------
  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],

  // -- Contract ---------------------------------------------------------------
  contract: {
    mode: "custom",
  },

  // -- Permissions ------------------------------------------------------------
  permissions: {
    payments: true,
  },
};
