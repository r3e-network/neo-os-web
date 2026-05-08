import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "ProfitAnchor Admin",
  description:
    "Operator console for manual NEO movement between ProfitAnchor AA agents.",
  icon: "settings",
  category: "console",
  shell: "console",
  theme: { family: "finance", density: "compact", accentColor: "#059669" },
  tabs: [
    { key: "overview", labelKey: "tabOverview", icon: "layout", default: true },
  ],
  stats: [
    {
      labelKey: "trackedNeo",
      valueKey: "totalNeoDisplay",
      format: "text",
      variant: "accent",
      icon: "archive",
    },
    {
      labelKey: "agentCount",
      valueKey: "agentCountDisplay",
      format: "text",
      icon: "users",
    },
    {
      labelKey: "selectedRoute",
      valueKey: "selectedAgentDisplay",
      format: "text",
      icon: "route",
    },
  ],
  sidebar: {
    titleKey: "adminScope",
    items: [
      { labelKey: "trackedNeo", valueKey: "totalNeoDisplay", format: "text" },
      { labelKey: "agentCount", valueKey: "agentCountDisplay", format: "text" },
      {
        labelKey: "selectedRoute",
        valueKey: "selectedAgentDisplay",
        format: "text",
      },
    ],
  },
  operations: [
    {
      key: "transferAgentNeo",
      titleKey: "moveNeo",
      descriptionKey: "moveNeoDesc",
      actionKey: "submitMove",
      actionMethod: "transferAgentNeo",
      priority: "primary",
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
      titleKey: "setCandidate",
      descriptionKey: "setCandidateDesc",
      actionKey: "submitCandidate",
      actionMethod: "setAgentCandidate",
      priority: "secondary",
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
        },
      ],
    },
    {
      key: "voteAgent",
      titleKey: "syncVote",
      descriptionKey: "syncVoteDesc",
      actionKey: "submitVote",
      actionMethod: "voteAgent",
      priority: "secondary",
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
  ],
  features: {
    walletRequired: true,
    chainWarning: true,
  },
  docs: [
    { titleKey: "operatorRule", contentKey: "operatorRuleDesc", type: "text" },
  ],
  contract: { mode: "custom" },
  permissions: {
    payments: true,
    governance: true,
    aa: true,
  },
};
