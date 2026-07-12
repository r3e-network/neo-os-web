import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "NeoPay Stream Studio",
  description: "Create and manage canonical GAS or NEO payment streams through a focused shared-runtime workstation",
  icon: "credit-card",
  category: "defi",
  shell: "launcher",
  theme: {
    family: "finance",
    accentColor: "#0f8f70",
    density: "comfortable",
  },

  // The designed stream workstation owns the full task hierarchy. Empty shell
  // chrome prevents generic tabs, stats, sidebars, or operation forms from
  // repeating the exact same payment inputs around the real product surface.
  tabs: [],
  stats: [],
  sidebar: { items: [] },
  operations: [],

  features: {
    walletRequired: true,
    chainWarning: true,
    comments: true,
    reviews: true,
    activityFeed: false,
  },

  docs: [
    { titleKey: "studioName", contentKey: "docsSubtitle", type: "text" },
    { titleKey: "docsDescription", contentKey: "guideStep1", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
    { titleKey: "feature2Name", contentKey: "feature2Desc", type: "features" },
    { titleKey: "feature3Name", contentKey: "feature3Desc", type: "features" },
  ],

  // Preserve the actual shared-runtime composition identity. The PlayArea is
  // product-owned; contract/module metadata remains in neo-manifest.json.
  contract: { mode: "shared" },
  permissions: { payments: true, storage: true },
};
