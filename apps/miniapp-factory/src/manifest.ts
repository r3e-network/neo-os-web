import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "MiniApp Factory",
  description: "Design deterministic MiniApp starter packages and register verified testnet records",
  icon: "blocks",
  category: "tool",
  shell: "launcher",
  theme: {
    family: "social",
    accentColor: "#15966a",
    density: "comfortable",
  },
  // The studio owns the creation flow, preview, progress and disclosures.
  // Keeping shell chrome empty prevents a duplicate dashboard around the app.
  tabs: [],
  stats: [],
  sidebar: { items: [] },
  operations: [],
  docs: [
    { titleKey: "docWhatItIs", contentKey: "docWhatItIsBody", type: "text" },
    { titleKey: "docSupportedTemplates", contentKey: "docSupportedTemplatesBody", type: "features" },
    { titleKey: "docSafetyModel", contentKey: "docSafetyModelBody", type: "text" },
  ],
  features: {
    walletRequired: false,
    chainWarning: true,
    comments: false,
    reviews: false,
    activityFeed: false,
  },
  contract: {
    mode: "template",
    recipeId: "factory.miniapp.template.v1",
  },
  permissions: {
    "invoke:platform-factory": true,
    storage: true,
  },
};
