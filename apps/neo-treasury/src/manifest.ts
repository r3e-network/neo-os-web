/**
 * Neo Treasury Manifest
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Neo Treasury",
  description: "Read-only Neo Foundation and ecosystem wallet tracking",
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

  features: {
    chainWarning: true,
  },

  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],

  permissions: { datafeed: true },
};
