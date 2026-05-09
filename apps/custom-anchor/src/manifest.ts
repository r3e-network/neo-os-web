import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Custom Anchor",
  description: "Stake, redeem, and claim rewards from a user-owned 21-agent NEO voting anchor.",
  icon: "anchor",
  category: "governance",
  shell: "console",
  theme: {
    family: "finance",
    accentColor: "#00E599",
    density: "compact",
  },
  tabs: [
    { key: "play", labelKey: "playTab", icon: "anchor", default: true },
    { key: "activity", labelKey: "activityTab", icon: "history" },
  ],
  stats: [
    { labelKey: "userStake", valueKey: "userStake", format: "text", variant: "success", icon: "lock" },
    { labelKey: "pendingRewards", valueKey: "pendingRewards", format: "text", variant: "accent", icon: "gift" },
    { labelKey: "totalStaked", valueKey: "totalStaked", format: "text", icon: "bar-chart" },
    { labelKey: "agentCount", valueKey: "agentCount", format: "number", icon: "users" },
  ],
  sidebar: {
    titleKey: "anchorStatus",
    items: [
      { labelKey: "userStake", valueKey: "userStake", format: "text" },
      { labelKey: "pendingRewards", valueKey: "pendingRewards", format: "text" },
      { labelKey: "rewardReserve", valueKey: "rewardReserve", format: "text" },
    ],
  },
  operations: [
    {
      key: "stake",
      titleKey: "stakeTitle",
      descriptionKey: "stakeDescription",
      actionKey: "stakeAction",
      actionMethod: "stake",
      priority: "primary",
      fields: [
        { key: "anchorAppId", type: "text", labelKey: "anchorAppId", placeholder: "custom-anchor:team:nonce", required: true },
        { key: "amount", type: "amount", labelKey: "neoAmount", placeholder: "10", required: true, validation: { min: 0.00000001 } },
      ],
    },
    {
      key: "claimRewards",
      titleKey: "claimTitle",
      descriptionKey: "claimDescription",
      actionKey: "claimAction",
      actionMethod: "claimRewards",
      priority: "primary",
      fields: [
        { key: "anchorAppId", type: "text", labelKey: "anchorAppId", placeholder: "custom-anchor:team:nonce", required: true },
      ],
    },
    {
      key: "withdraw",
      titleKey: "withdrawTitle",
      descriptionKey: "withdrawDescription",
      actionKey: "withdrawAction",
      actionMethod: "withdraw",
      priority: "primary",
      fields: [
        { key: "anchorAppId", type: "text", labelKey: "anchorAppId", placeholder: "custom-anchor:team:nonce", required: true },
        { key: "amount", type: "amount", labelKey: "neoAmount", placeholder: "10", required: true, validation: { min: 0.00000001 } },
      ],
    },
  ],
  docs: [
    { titleKey: "docPurpose", contentKey: "docPurposeBody", type: "text" },
    { titleKey: "docSafety", contentKey: "docSafetyBody", type: "text" },
  ],
  features: {
    walletRequired: true,
    chainWarning: true,
    comments: true,
    reviews: true,
    activityFeed: true,
  },
  contract: {
    mode: "shared",
    moduleId: "PlatformAnchor",
  },
  permissions: {
    storage: true,
  },
};
