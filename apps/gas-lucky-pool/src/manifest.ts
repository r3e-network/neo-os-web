import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "OneGate Vault",
  description: "Server-backed 1-50 GAS rewards claimed through OneGate QR keys",
  icon: "gift",
  category: "social",
  shell: "launcher",

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
          hidden: true,
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
