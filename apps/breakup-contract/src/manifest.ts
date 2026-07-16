import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Breakup Contract",
  description: "On-chain relationship contracts with stakes",
  icon: "broken_heart",
  category: "social",
  shell: "launcher",

  tabs: [
    { key: "create", labelKey: "tabCreate", icon: "broken_heart", default: true },
  ],

  // The chrome renders these with no loading gate of its own, and the counts
  // derive from a list that rests at `[]` — so it published "Contracts 0 ·
  // Active 0 · Broken 0" before any read had run, and to any visitor with no
  // wallet connected. A count is a claim, and absence is not zero.
  //
  // These bind the `*Display` read-outs, which know which phase the read is in
  // and declare `pendingKey` for the unread one. A settled zero is a real
  // reading and still renders as 0. The raw counts stay numbers for the
  // PlayArea's badges.
  stats: [
    { labelKey: "active", valueKey: "activeCountDisplay", format: "number", variant: "success", icon: "heart", pendingKey: "breakupReading" },
    { labelKey: "pending", valueKey: "pendingCountDisplay", format: "number", variant: "warning", icon: "clock", pendingKey: "breakupReading" },
    { labelKey: "total", valueKey: "contractCountDisplay", format: "number", icon: "file-text", pendingKey: "breakupReading" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "tabContracts", valueKey: "contractCountDisplay", format: "number", pendingKey: "breakupReading" },
      { labelKey: "active", valueKey: "activeCountDisplay", format: "number", pendingKey: "breakupReading" },
      { labelKey: "broken", valueKey: "brokenCountDisplay", format: "number", pendingKey: "breakupReading" },
    ],
  },

  features: { walletRequired: true, chainWarning: true },

  docs: [
    { titleKey: "title", contentKey: "subtitle", type: "text" },
  ],

  contract: { mode: "custom" },
  permissions: { payments: true },
};
