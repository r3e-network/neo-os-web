import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "NFT Factory",
  description: "Design and sign deterministic NEP-11 collection packages",
  icon: "image",
  category: "social",
  shell: "console",
  theme: {
    family: "social",
    accentColor: "#168f72",
    density: "comfortable",
  },
  // The app-owned studio already presents the complete creator workflow.
  // Empty shell chrome avoids repeating its status, actions, and history as a
  // generic dashboard around the artwork.
  tabs: [],
  stats: [],
  sidebar: {
    items: [],
  },
  operations: [],
  docs: [
    { titleKey: "docWhatItIs", contentKey: "docWhatItIsBody", type: "text" },
    { titleKey: "docSupportedTemplates", contentKey: "docSupportedTemplatesBody", type: "features" },
    { titleKey: "docSafetyModel", contentKey: "docSafetyModelBody", type: "text" },
  ],
  features: {
    walletRequired: false,
    chainWarning: true,
    comments: true,
    reviews: true,
    activityFeed: false,
  },
  contract: {
    mode: "template",
    recipeId: "factory.nep11.collection.v1",
  },
  permissions: {
    "invoke:platform-factory": true,
    payments: false,
    storage: false,
  },
};
