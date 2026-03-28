import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Memorial Shrine",
  description: "Create permanent memorials on the blockchain",
  icon: "candle",
  category: "social",
  shell: "launcher",

  tabs: [
    { key: "memorials", labelKey: "memorials", icon: "candle", default: true },
    { key: "tributes", labelKey: "myTributes", icon: "heart" },
  ],

  stats: [
    { labelKey: "memorials", valueKey: "memorialCount", format: "number", icon: "candle" },
    { labelKey: "myTributes", valueKey: "tributeCount", format: "number", icon: "heart" },
    { labelKey: "sidebarObituaries", valueKey: "obituaryCount", format: "number", icon: "scroll" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "memorials", valueKey: "memorialCount", format: "number" },
      { labelKey: "myTributes", valueKey: "tributeCount", format: "number" },
      { labelKey: "sidebarObituaries", valueKey: "obituaryCount", format: "number" },
    ],
  },

  features: { walletRequired: true, chainWarning: true },

  docs: [
    { titleKey: "title", contentKey: "tagline", type: "text" },
  ],

  contract: { mode: "custom" },
  permissions: { payments: true },
};
