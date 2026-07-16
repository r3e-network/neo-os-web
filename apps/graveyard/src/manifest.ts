import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Graveyard",
  description: "Create local SHA-256 memory commitments with paid on-chain forgetting records",
  icon: "history",
  category: "tool",
  shell: "launcher",

  tabs: [
    { key: "main", labelKey: "destroy", icon: "trash-2", default: true },
  ],

  // The chrome renders these with no loading gate of its own, so they bind the
  // `*Display` read-outs, which know which phase the burial read is in, and
  // declare `pendingKey` for the unread one. The raw `totalDestroyed` /
  // `historyCount` stay numbers for the PlayArea's arithmetic.
  //
  // These counts used to rest at `0`, so the chrome published "Total destroyed
  // 0" — a number asserting this wallet has destroyed nothing, before any read
  // had run. A settled zero is a real reading and still renders as 0.
  stats: [
    { labelKey: "totalDestroyed", valueKey: "totalDestroyedDisplay", format: "number", icon: "archive", pendingKey: "graveyardReading" },
    { labelKey: "gasReclaimed", valueKey: "gasReclaimedDisplay", format: "text", variant: "success", icon: "zap", pendingKey: "graveyardReading" },
    { labelKey: "history", valueKey: "historyCountDisplay", format: "number", icon: "clock", pendingKey: "graveyardReading" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "totalDestroyed", valueKey: "totalDestroyedDisplay", format: "number", pendingKey: "graveyardReading" },
      { labelKey: "gasReclaimed", valueKey: "gasReclaimedDisplay", format: "text", pendingKey: "graveyardReading" },
      { labelKey: "history", valueKey: "historyCountDisplay", format: "number", pendingKey: "graveyardReading" },
    ],
  },

  features: {
    fireworks: false,
    walletRequired: true,
    chainWarning: true,
  },

  docs: [
    { titleKey: "title", contentKey: "subtitle", type: "text" },
  ],

  contract: { mode: "custom" },
  permissions: { payments: true },
};
