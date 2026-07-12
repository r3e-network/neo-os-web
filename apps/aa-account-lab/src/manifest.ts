import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "AA Account Lab",
  description: "Inspect and register recoverable Neo AA account shells with exact chain confirmation",
  icon: "badge",
  category: "tool",
  shell: "console",
  theme: {
    family: "finance",
    accentColor: "#0f8f70",
    density: "comfortable",
  },
  // The account control center owns its hierarchy, live state, recovery and
  // write actions. Empty shell chrome prevents a duplicate generic dashboard.
  tabs: [],
  stats: [],
  sidebar: { items: [] },
  operations: [],
  features: {
    walletRequired: false,
    chainWarning: true,
    comments: true,
    reviews: true,
    activityFeed: false,
  },
  docs: [
    { titleKey: "appName", contentKey: "docsSubtitle", type: "text" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
    { titleKey: "feature2Name", contentKey: "feature2Desc", type: "features" },
    { titleKey: "feature3Name", contentKey: "feature3Desc", type: "features" },
  ],
  contract: { mode: "custom" },
  permissions: { aa: true, storage: true },
};
