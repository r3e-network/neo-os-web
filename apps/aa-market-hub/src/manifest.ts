import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "AA Market Hub",
  description: "Discover, list, buy, and manage canonical AA address shells",
  icon: "store",
  category: "defi",
  shell: "launcher",
  theme: {
    family: "finance",
    accentColor: "#0f8f68",
    density: "comfortable",
  },

  // The designed marketplace owns discovery, creation, purchase, seller
  // controls, and transaction recovery. Generic host operation forms would
  // duplicate these flows and turn the product back into a parameter sheet.
  operations: [],

  features: {
    walletRequired: false,
    chainWarning: true,
  },

  docs: [
    { titleKey: "appName", contentKey: "docsSubtitle", type: "text" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
    { titleKey: "feature2Name", contentKey: "feature2Desc", type: "features" },
    { titleKey: "feature3Name", contentKey: "feature3Desc", type: "features" },
  ],

  contract: { mode: "custom" },
  permissions: { aa: true, payments: true, storage: true },
};
