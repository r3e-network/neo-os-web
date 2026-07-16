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
  // loading gate of its own, so each one declares `pendingKey`: while the
  // watchlist read is in flight the bound observable holds `undefined`, and the
  // chrome says "Reading…" instead of formatting the void into a dash — or, for
  // `founderCount`, into a fabricated `0` asserting this watchlist tracks
  // nobody. The PlayArea shows its own richer gating for the same phase.
  // See main.tsx.
  stats: [
    { labelKey: "sidebarTotalUsd", valueKey: "totalUsdDisplay", format: "text", variant: "success", icon: "dollar-sign", pendingKey: "treasuryStatAwaitingRead" },
    { labelKey: "sidebarTotalNeo", valueKey: "totalNeoDisplay", format: "text", icon: "circle", pendingKey: "treasuryStatAwaitingRead" },
    { labelKey: "sidebarTotalGas", valueKey: "totalGasDisplay", format: "text", icon: "zap", pendingKey: "treasuryStatAwaitingRead" },
    { labelKey: "sidebarFounders", valueKey: "founderCount", format: "number", icon: "users", pendingKey: "treasuryStatAwaitingRead" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "sidebarTotalUsd", valueKey: "totalUsdDisplay", format: "text", pendingKey: "treasuryStatAwaitingRead" },
      { labelKey: "sidebarTotalNeo", valueKey: "totalNeoDisplay", format: "text", pendingKey: "treasuryStatAwaitingRead" },
      { labelKey: "sidebarTotalGas", valueKey: "totalGasDisplay", format: "text", pendingKey: "treasuryStatAwaitingRead" },
      { labelKey: "sidebarFounders", valueKey: "founderCount", format: "number", pendingKey: "treasuryStatAwaitingRead" },
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
