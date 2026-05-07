import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "NFT Factory",
  description: "Create NEP-11 collections from governed on-chain templates",
  icon: "image",
  category: "tool",
  shell: "console",
  theme: {
    family: "default",
    accentColor: "#00E599",
    density: "comfortable",
  },
  tabs: [
    { key: "play", labelKey: "playTab", icon: "image", default: true },
    { key: "activity", labelKey: "activityTab", icon: "history" },
  ],
  stats: [
    { labelKey: "planStatus", valueKey: "planStatus", format: "text", variant: "success", icon: "check-circle" },
    { labelKey: "packageDigest", valueKey: "shortDigest", format: "text", variant: "accent", icon: "hash" },
    { labelKey: "blockingIssues", valueKey: "blockingIssueCount", format: "number", variant: "warning", icon: "alert" },
    { labelKey: "generatedPackages", valueKey: "generatedCount", format: "number", icon: "archive" },
  ],
  sidebar: {
    titleKey: "factoryOverview",
    items: [
      { labelKey: "activeTemplate", valueKey: "activeTemplateLabel", format: "text" },
      { labelKey: "targetNetwork", valueKey: "targetNetwork", format: "text" },
      { labelKey: "planStatus", valueKey: "planStatus", format: "text" },
      { labelKey: "signatureState", valueKey: "signatureState", format: "text" },
    ],
  },
  operations: [
    {
      key: "signCurrentPlan",
      titleKey: "signPlanTitle",
      descriptionKey: "signPlanDescription",
      actionKey: "signPlanAction",
      actionMethod: "signCurrentPlan",
      fields: [],
    },
  ],
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
    activityFeed: true,
  },
  contract: {
    mode: "template",
    recipeId: "factory.nep11.collection.v1",
  },
  permissions: {
    storage: true,
  },
};
