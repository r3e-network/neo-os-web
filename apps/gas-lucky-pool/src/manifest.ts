import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "OneGate Vault",
  description: "Random 1-50 GAS rewards: recipients claim via OneGate QR keys; campaign owners create, fund, and recover the reward pools",
  icon: "gift",
  category: "social",
  // `shell: "game"` renders the two-choice launcher entry (Earn GAS / Play free);
  // because this manifest has `operations`, the host template still resolves to
  // "two-column" (see manifestToTemplateConfig), so the gamefi surface is
  // unchanged — the launcher just adds the guest/gamefi choice in front.
  shell: "game",
  // Two-mode opt-in. No full gamePage block, so opt in via the top-level flag —
  // GUEST is a purely local lucky draw (see logic/guest-engine.ts); GAMEFI is the
  // existing on-chain OneGate claim/pool flow, unchanged.
  supportsGuest: true,

  tabs: [
    { key: "play", labelKey: "playTab", icon: "gift", default: true },
    { key: "activity", labelKey: "activityTab", icon: "history" },
  ],

  operations: [
    {
      key: "claimPool",
      titleKey: "claimPoolTitle",
      descriptionKey: "claimPoolDescription",
      actionKey: "claimReward",
      actionMethod: "claimPool",
      priority: "primary",
      fields: [
        {
          key: "claimKey",
          type: "text",
          labelKey: "claimKey",
          placeholder: "ogv_campaign_user_key",
          required: true,
        },
        {
          key: "poolId",
          type: "text",
          labelKey: "poolId",
          placeholder: "pool-001",
          required: false,
        },
      ],
    },
  ],

  docs: [
    { titleKey: "howItWorks", contentKey: "docHowItWorks", type: "steps" },
    { titleKey: "safetyModel", contentKey: "docSafetyModel", type: "text" },
    { titleKey: "oneGateFlow", contentKey: "docOneGateFlow", type: "text" },
  ],

  features: {
    fireworks: true,
    walletRequired: true,
    chainWarning: true,
    comments: true,
    reviews: true,
    activityFeed: true,
  },

  permissions: {
    payments: true,
    randomness: true,
  },
};
