/**
 * ProfitAnchor Manifest
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "ProfitAnchor",
  description: "User-facing ProfitAnchor staking app for staking NEO, redeeming NEO, and claiming GAS rewards.",
  icon: "trending-up",
  category: "defi",
  shell: "launcher",

  tabs: [
    { key: "overview", labelKey: "tabOverview", icon: "layout", default: true },
  ],

  stats: [
    {
      labelKey: "myStake",
      valueKey: "myStakeDisplay",
      format: "text",
      variant: "accent",
      icon: "lock",
    },
    {
      labelKey: "pendingRewards",
      valueKey: "pendingRewardsDisplay",
      format: "text",
      variant: "success",
      icon: "gift",
    },
    {
      labelKey: "totalNeoTracked",
      valueKey: "totalNeoDisplay",
      format: "text",
      icon: "archive",
    },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      {
        labelKey: "myStake",
        valueKey: "myStakeDisplay",
        format: "text",
      },
      {
        labelKey: "pendingRewards",
        valueKey: "pendingRewardsDisplay",
        format: "text",
      },
      {
        labelKey: "totalNeoTracked",
        valueKey: "totalNeoDisplay",
        format: "text",
      },
    ],
  },

  operations: [
    {
      key: "stakeNeo",
      titleKey: "stakeNeo",
      descriptionKey: "stakeNeoDesc",
      actionKey: "submitStake",
      actionMethod: "stakeNeo",
      priority: "primary",
      fields: [
        {
          key: "amount",
          type: "number",
          labelKey: "neoAmount",
          placeholder: "1",
          required: true,
          validation: { min: 1 },
        },
      ],
    },
    {
      key: "withdrawNeo",
      titleKey: "withdrawNeo",
      descriptionKey: "withdrawNeoDesc",
      actionKey: "submitWithdraw",
      actionMethod: "withdrawNeo",
      priority: "primary",
      fields: [
        {
          key: "amount",
          type: "number",
          labelKey: "neoAmount",
          placeholder: "1",
          required: true,
          validation: { min: 1 },
        },
      ],
    },
    {
      key: "claimRewards",
      titleKey: "claimRewards",
      descriptionKey: "claimRewardsDesc",
      actionKey: "submitClaim",
      actionMethod: "claimRewards",
      priority: "primary",
      fields: [],
    },
  ],

  features: {
    walletRequired: true,
    chainWarning: true,
  },

  docs: [
    { titleKey: "title", contentKey: "docsSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],

  contract: {
    mode: "custom",
  },

  permissions: {
    payments: true,
    governance: true,
    aa: true,
  },
};
