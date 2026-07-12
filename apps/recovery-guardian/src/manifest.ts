import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Recovery Guardian",
  description: "Inspect and manage existing AA guardian recovery profiles",
  icon: "shield",
  category: "tool",
  shell: "launcher",
  tabs: [],
  stats: [],
  operations: [],
  features: {
    walletRequired: false,
    chainWarning: true,
  },
  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],
  permissions: { aa: true },
  contract: { mode: "custom" },
};
