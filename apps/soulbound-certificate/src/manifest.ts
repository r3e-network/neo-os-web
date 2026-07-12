import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Soulbound Certificate",
  description: "Issue and manage soulbound NFT certificates",
  icon: "award",
  category: "social",
  shell: "launcher",
  theme: {
    family: "social",
    accentColor: "#0f766e",
    density: "comfortable",
  },

  // The credential atelier owns public verification, template design, issuing,
  // management, and recovery. Generic host tabs/stats/forms would duplicate
  // that journey and flatten the certificate artifact back into a form sheet.
  operations: [],

  features: { walletRequired: false, chainWarning: true },

  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
    { titleKey: "feature2Name", contentKey: "feature2Desc", type: "features" },
    { titleKey: "feature3Name", contentKey: "feature3Desc", type: "features" },
  ],

  permissions: { payments: false, storage: true },

  contract: { mode: "custom" },
};
