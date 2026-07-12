import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Custom Anchor",
  description: "Stake, redeem, and claim rewards from a user-owned 21-agent NEO voting anchor.",
  icon: "anchor",
  category: "governance",
  shell: "console",
  theme: {
    family: "finance",
    accentColor: "#0f8f70",
    density: "comfortable",
  },
  // The app-owned staking stage already carries the hierarchy, status and
  // recovery controls. Empty shell chrome prevents duplicate form/dashboard
  // surfaces from competing with the single primary stake action.
  tabs: [],
  stats: [],
  sidebar: { items: [] },
  operations: [],
  docs: [
    { titleKey: "docPurpose", contentKey: "docPurposeBody", type: "text" },
    { titleKey: "docSafety", contentKey: "docSafetyBody", type: "text" },
  ],
  features: {
    walletRequired: true,
    chainWarning: true,
    comments: true,
    reviews: true,
    activityFeed: false,
  },
  contract: {
    mode: "shared",
    moduleId: "PlatformAnchor",
  },
  permissions: {
    storage: true,
  },
};
