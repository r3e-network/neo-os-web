import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "AA Permissions",
  description: "Inspect, install, and safely rotate AA verifier or hook bindings",
  icon: "shield",
  category: "console",
  shell: "console",

  tabs: [
    { key: "permissions", labelKey: "appName", icon: "shield", default: true },
  ],

  // The chrome renders these with no gate of its own, and these bindings rested
  // at "" — so an uninspected account published three blank tiles. They bind the
  // `*Display` read-outs, which distinguish "not inspected" (nothing read yet →
  // `pendingKey`) from "none bound" (inspected, zero hash → a real reading).
  // The raw hashes stay bound to nothing here; the PlayArea reads those.
  stats: [
    { labelKey: "currentVerifier", valueKey: "currentVerifierDisplay", format: "text", icon: "shield", pendingKey: "notInspected" },
    { labelKey: "currentHook", valueKey: "currentHookDisplay", format: "text", icon: "link", pendingKey: "notInspected" },
    { labelKey: "backupOwner", valueKey: "currentBackupOwnerDisplay", format: "text", icon: "user", pendingKey: "notInspected" },
  ],

  sidebar: {
    titleKey: "appName",
    items: [
      { labelKey: "currentVerifier", valueKey: "currentVerifierDisplay", format: "text", pendingKey: "notInspected" },
      { labelKey: "currentHook", valueKey: "currentHookDisplay", format: "text", pendingKey: "notInspected" },
      { labelKey: "backupOwner", valueKey: "currentBackupOwnerDisplay", format: "text", pendingKey: "notInspected" },
    ],
  },

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

  permissions: {
    aa: true,
  },
};
