import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Event Ticket Pass",
  description: "Discover events, collect organizer-issued NFT passes, and run recoverable door check-in.",
  icon: "ticket",
  category: "social",
  shell: "market",

  // PlayArea owns the complete event discovery, pass, organizer and gate-desk
  // hierarchy. Generic launcher tabs/stats would duplicate that navigation.
  tabs: [],

  stats: [],

  sidebar: { titleKey: "title", items: [] },

  // Public event discovery is intentionally wallet-free. Wallet connection is
  // requested only at organizer, transfer, inventory and check-in boundaries.
  features: { walletRequired: false, chainWarning: true },

  docs: [
    { titleKey: "title", contentKey: "subtitle", type: "text" },
  ],

  permissions: { payments: false, storage: false },

  contract: { mode: "custom" },
};
