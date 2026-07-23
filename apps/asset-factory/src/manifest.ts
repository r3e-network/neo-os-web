import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Asset Factory",
  description:
    "Design, validate, and sign deterministic NEP-17 issuance blueprints",
  icon: "coins",
  category: "tool",
  shell: "console",
  theme: {
    family: "finance",
    accentColor: "#0d8a5f",
    density: "comfortable",
  },
  // The app-owned Token Studio already renders the object, workflow, status,
  // signature, and record-recovery surfaces. Empty shell chrome prevents a
  // second generic dashboard/sign form from competing with the primary task.
  tabs: [],
  stats: [],
  sidebar: {
    items: [],
  },
  operations: [],
  docs: [
    { titleKey: "docWhatItIs", contentKey: "docWhatItIsBody", type: "text" },
    {
      titleKey: "docSupportedTemplates",
      contentKey: "docSupportedTemplatesBody",
      type: "features",
    },
    {
      titleKey: "docSafetyModel",
      contentKey: "docSafetyModelBody",
      type: "text",
    },
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
    recipeId: "factory.nep17.asset.v1",
  },
  permissions: {
    "invoke:platform-factory": true,
    storage: true,
  },
};
