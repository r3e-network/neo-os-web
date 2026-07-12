import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Memorial Shrine",
  description: "Create permanent memorials on the blockchain",
  icon: "candle",
  category: "social",
  shell: "launcher",

  // PlayStage owns the one primary memorial/tribute flow. Do not duplicate it
  // as launcher tabs, stat cards, sidebar rows, or generic operation forms.
  tabs: [],
  stats: [],
  sidebar: { items: [] },
  operations: [],

  features: { walletRequired: true, chainWarning: true },

  docs: [
    { titleKey: "title", contentKey: "tagline", type: "text" },
  ],

  contract: { mode: "custom" },
  permissions: { payments: true },
};
