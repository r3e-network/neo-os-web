/**
 * Neo Pay Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the miniapp *except* the play area.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Neo Pay",
  description: "Create and manage streaming payment vaults",
  icon: "credit-card",
  category: "defi",
  shell: "launcher",

  tabs: [
    { key: "create", labelKey: "createTab", icon: "plus", default: true },
  ],

  stats: [
    { labelKey: "myCreated", valueKey: "createdStreamCount", format: "number", icon: "upload" },
    { labelKey: "beneficiaryVaults", valueKey: "beneficiaryStreamCount", format: "number", icon: "download" },
    { labelKey: "statusActive", valueKey: "activeCount", format: "number", variant: "accent", icon: "play" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "myCreated", valueKey: "createdStreamCount", format: "number" },
      { labelKey: "beneficiaryVaults", valueKey: "beneficiaryStreamCount", format: "number" },
      { labelKey: "statusActive", valueKey: "activeCount", format: "number" },
    ],
  },

  operations: [
    {
      key: "createStream",
      titleKey: "createStream",
      descriptionKey: "createStreamDescription",
      actionKey: "createStream",
      actionMethod: "createStream",
      priority: "primary",
      fields: [
        {
          key: "recipient",
          type: "address",
          labelKey: "recipient",
          placeholder: "N...",
          required: true,
        },
        {
          key: "amount",
          type: "amount",
          labelKey: "amount",
          placeholder: "0.03",
          required: true,
          validation: { min: 0.00000001 },
        },
        {
          key: "duration",
          type: "number",
          labelKey: "duration",
          placeholder: "7",
          required: true,
          validation: { min: 1, max: 365 },
        },
        {
          key: "token",
          type: "select",
          labelKey: "token",
          default: "GAS",
          required: true,
          options: [
            { value: "GAS", label: "GAS" },
            { value: "NEO", label: "NEO" },
          ],
        },
        {
          key: "notes",
          type: "text",
          labelKey: "notes",
          placeholder: "Optional context",
        },
      ],
    },
    {
      key: "claimStream",
      titleKey: "claim",
      descriptionKey: "claimStreamDescription",
      actionKey: "claim",
      actionMethod: "claimStream",
      priority: "secondary",
      fields: [
        {
          key: "streamId",
          type: "number",
          labelKey: "streamId",
          placeholder: "1",
          required: true,
          validation: { min: 1 },
        },
      ],
    },
    {
      key: "cancelStream",
      titleKey: "cancel",
      descriptionKey: "cancelStreamDescription",
      actionKey: "cancel",
      actionMethod: "cancelStream",
      priority: "operator",
      fields: [
        {
          key: "streamId",
          type: "number",
          labelKey: "streamId",
          placeholder: "1",
          required: true,
          validation: { min: 1 },
        },
      ],
    },
  ],

  features: { walletRequired: true, chainWarning: true },

  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step1", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
    { titleKey: "feature2Name", contentKey: "feature2Desc", type: "features" },
    { titleKey: "feature3Name", contentKey: "feature3Desc", type: "features" },
  ],

  contract: { mode: "custom" },

  permissions: { payments: true },
};
