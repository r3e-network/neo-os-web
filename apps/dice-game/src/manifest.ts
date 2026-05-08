import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Dice Game",
  description: "Pick one face and roll with Morpheus VRF on Neo N3.",
  icon: "dice",
  category: "game",
  shell: "game",

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

  operations: [
    {
      key: "placeDiceBet",
      titleKey: "rollDice",
      descriptionKey: "rollDescription",
      actionKey: "rollAction",
      actionMethod: "placeDiceBet",
      priority: "primary",
      fields: [
        {
          key: "chosenNumber",
          type: "select",
          labelKey: "selectedFace",
          required: true,
          default: "6",
          options: [
            { value: "1", label: "1" },
            { value: "2", label: "2" },
            { value: "3", label: "3" },
            { value: "4", label: "4" },
            { value: "5", label: "5" },
            { value: "6", label: "6" },
          ],
        },
        {
          key: "amount",
          type: "amount",
          labelKey: "stakeAmount",
          placeholder: "0.10",
          required: true,
          default: "0.10",
          validation: { min: 0.05, max: 20 },
        },
      ],
    },
  ],

  docs: [
    { titleKey: "howItWorks", contentKey: "docHowItWorks", type: "steps" },
    { titleKey: "safetyModel", contentKey: "docSafetyModel", type: "text" },
  ],

  features: {
    walletRequired: true,
    chainWarning: true,
    fireworks: true,
    activityFeed: true,
    reviews: true,
    comments: true,
  },

  permissions: {
    payments: true,
    randomness: true,
  },

  contract: {
    mode: "custom",
  },
};
