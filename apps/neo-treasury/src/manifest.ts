/**
 * Neo Treasury Manifest
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Neo Treasury",
  description: "Neo treasury balance oversight with connected-wallet disbursements",
  icon: "landmark",
  category: "tool",
  shell: "launcher",

  tabs: [
    { key: "total", labelKey: "tabTotal", icon: "bar-chart", default: true },
    { key: "da", labelKey: "tabDa", icon: "user" },
    { key: "erik", labelKey: "tabErik", icon: "user" },
  ],

  stats: [
    { labelKey: "sidebarTotalUsd", valueKey: "totalUsdDisplay", format: "text", variant: "success", icon: "dollar-sign" },
    { labelKey: "sidebarTotalNeo", valueKey: "totalNeoDisplay", format: "text", icon: "circle" },
    { labelKey: "sidebarTotalGas", valueKey: "totalGasDisplay", format: "text", icon: "zap" },
    { labelKey: "sidebarFounders", valueKey: "founderCount", format: "number", icon: "users" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "sidebarTotalUsd", valueKey: "totalUsdDisplay", format: "text" },
      { labelKey: "sidebarTotalNeo", valueKey: "totalNeoDisplay", format: "text" },
      { labelKey: "sidebarTotalGas", valueKey: "totalGasDisplay", format: "text" },
      { labelKey: "sidebarFounders", valueKey: "founderCount", format: "number" },
    ],
  },

  operations: [
    {
      key: "submitDisbursement",
      titleKey: "disbursementTitle",
      descriptionKey: "disbursementBoundary",
      actionKey: "submitDisbursement",
      actionMethod: "submitDisbursement",
      priority: "primary",
      fields: [
        {
          key: "asset",
          type: "select",
          labelKey: "asset",
          default: "GAS",
          required: true,
          options: [
            { value: "GAS", label: "GAS" },
            { value: "NEO", label: "NEO" },
          ],
        },
        {
          key: "amount",
          type: "amount",
          labelKey: "amount",
          placeholder: "1",
          required: true,
          validation: { min: 0.00000001 },
        },
        {
          key: "recipient",
          type: "address",
          labelKey: "recipient",
          placeholder: "N...",
          required: true,
        },
        {
          key: "memo",
          type: "text",
          labelKey: "memo",
          default: "treasury-disbursement",
        },
      ],
    },
    {
      key: "refresh",
      titleKey: "treasuryLiveStatus",
      actionKey: "refreshData",
      actionMethod: "refresh",
      priority: "secondary",
    },
  ],

  features: {
    chainWarning: true,
  },

  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],

  permissions: { datafeed: true, payments: true },
};
