import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

/**
 * PlayStage owns the complete user journey. Generic tabs, stat cards, sidebar,
 * and operation forms are intentionally omitted so the same staking controls
 * never appear twice.
 */
export const manifest: MiniAppManifest = {
  name: "ProfitAnchor",
  description: "Yield-policy NEO staking through the live PlatformAnchor mode 2 pool, with variable GAS rewards and explicit confirmation recovery.",
  icon: "trending-up",
  category: "defi",
  shell: "launcher",
  directPlay: true,
  theme: {
    family: "finance",
    accentColor: "#0a7a66",
    density: "comfortable",
  },
  features: {
    chainWarning: true,
  },
  contract: {
    mode: "shared",
    moduleId: "PlatformAnchor",
  },
  permissions: {
    "invoke:platform-anchor": true,
    payments: true,
  },
};
