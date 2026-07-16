/**
 * Neo Treasury Manifest
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Neo Treasury",
  description: "Public Mainnet treasury watchlist with verified connected-wallet NEO/GAS transfers",
  icon: "landmark",
  category: "tool",
  shell: "launcher",

  tabs: [
    { key: "total", labelKey: "tabTotal", icon: "bar-chart", default: true },
    { key: "da", labelKey: "tabDa", icon: "user" },
    { key: "erik", labelKey: "tabErik", icon: "user" },
  ],

  // These bind straight into shell chrome that MiniAppRoot renders with no
  // loading gate, so they must point at the `*StatDisplay` read-outs, never at
  // the PlayArea's raw pair. The raw ones fall back to "—" (and `founderCount`
  // to a fabricated `0`) while the watchlist read is in flight — honest only
  // because the PlayArea pairs them with its own "Reading public chain data"
  // shimmer, which the chrome has no way to show. See main.tsx.
  stats: [
    { labelKey: "sidebarTotalUsd", valueKey: "totalUsdStatDisplay", format: "text", variant: "success", icon: "dollar-sign" },
    { labelKey: "sidebarTotalNeo", valueKey: "totalNeoStatDisplay", format: "text", icon: "circle" },
    { labelKey: "sidebarTotalGas", valueKey: "totalGasStatDisplay", format: "text", icon: "zap" },
    { labelKey: "sidebarFounders", valueKey: "founderCountStatDisplay", format: "text", icon: "users" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "sidebarTotalUsd", valueKey: "totalUsdStatDisplay", format: "text" },
      { labelKey: "sidebarTotalNeo", valueKey: "totalNeoStatDisplay", format: "text" },
      { labelKey: "sidebarTotalGas", valueKey: "totalGasStatDisplay", format: "text" },
      { labelKey: "sidebarFounders", valueKey: "founderCountStatDisplay", format: "text" },
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
