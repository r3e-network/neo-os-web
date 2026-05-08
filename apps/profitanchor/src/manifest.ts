/**
 * ProfitAnchor Manifest
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "ProfitAnchor",
  description: "Manual 21-agent AA routing for profit-policy NEO voting",
  icon: "trending-up",
  category: "defi",
  shell: "launcher",

  tabs: [
    { key: "overview", labelKey: "tabOverview", icon: "layout", default: true },
    { key: "routing", labelKey: "tabRouting", icon: "trending-up" },
    { key: "architecture", labelKey: "tabArchitecture", icon: "layers" },
  ],

  stats: [
    {
      labelKey: "totalNeoTracked",
      valueKey: "totalNeoDisplay",
      format: "text",
      variant: "accent",
      icon: "lock",
    },
    {
      labelKey: "rewardReserve",
      valueKey: "rewardReserveDisplay",
      format: "text",
      variant: "success",
      icon: "gift",
    },
    {
      labelKey: "agentAccountsLabel",
      valueKey: "agentCount",
      format: "number",
      icon: "grid",
    },
    {
      labelKey: "agentTargetCount",
      valueKey: "ingressCount",
      format: "number",
      icon: "arrow-down",
    },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      {
        labelKey: "totalNeoTracked",
        valueKey: "totalNeoDisplay",
        format: "text",
      },
      {
        labelKey: "rewardReserve",
        valueKey: "rewardReserveDisplay",
        format: "text",
      },
      {
        labelKey: "agentAccountsLabel",
        valueKey: "agentCount",
        format: "number",
      },
      {
        labelKey: "agentTargetCount",
        valueKey: "ingressCount",
        format: "number",
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
    {
      key: "transferAgentNeo",
      titleKey: "moveNeo",
      descriptionKey: "moveNeoDesc",
      actionKey: "submitMove",
      actionMethod: "transferAgentNeo",
      priority: "operator",
      fields: [
        {
          key: "fromAgentId",
          type: "number",
          labelKey: "fromAgentId",
          placeholder: "1",
          required: true,
          validation: { min: 1, max: 21 },
        },
        {
          key: "toAgentId",
          type: "number",
          labelKey: "toAgentId",
          placeholder: "2",
          required: true,
          validation: { min: 1, max: 21 },
        },
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
      key: "setAgentCandidate",
      titleKey: "updateVoteTarget",
      descriptionKey: "updateVoteTargetDesc",
      actionKey: "submitCandidate",
      actionMethod: "setAgentCandidate",
      priority: "operator",
      fields: [
        {
          key: "agentId",
          type: "number",
          labelKey: "agentId",
          placeholder: "1",
          required: true,
          validation: { min: 1, max: 21 },
        },
        {
          key: "candidate",
          type: "text",
          labelKey: "candidatePublicKey",
          placeholder: "02...",
          required: true,
          validation: { pattern: "^(02|03)[0-9a-fA-F]{64}$" },
        },
      ],
    },
    {
      key: "voteAgent",
      titleKey: "syncVote",
      descriptionKey: "syncVoteDesc",
      actionKey: "submitVote",
      actionMethod: "voteAgent",
      priority: "operator",
      fields: [
        {
          key: "agentId",
          type: "number",
          labelKey: "agentId",
          placeholder: "1",
          required: true,
          validation: { min: 1, max: 21 },
        },
      ],
    },
    {
      key: "registerAgent",
      titleKey: "registerAgent",
      descriptionKey: "registerAgentDesc",
      actionKey: "submitRegisterAgent",
      actionMethod: "registerAgent",
      priority: "operator",
      fields: [
        {
          key: "agentAccount",
          type: "address",
          labelKey: "agentAccount",
          placeholder: "N...",
          required: true,
        },
        {
          key: "candidate",
          type: "text",
          labelKey: "candidatePublicKey",
          placeholder: "02...",
          required: true,
          validation: { pattern: "^(02|03)[0-9a-fA-F]{64}$" },
        },
        {
          key: "verificationScriptHash",
          type: "text",
          labelKey: "verificationScriptHash",
          placeholder: "hex",
          required: true,
          validation: { pattern: "^(0x)?[0-9a-fA-F]+$" },
        },
      ],
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
