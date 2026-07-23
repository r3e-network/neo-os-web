import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

/**
 * PlayStage owns the complete user journey. Generic tabs, stat cards, sidebar,
 * and operation forms are intentionally omitted so the same staking controls
 * never appear twice.
 */
export const manifest: MiniAppManifest = {
  name: "TrustAnchor",
  description: "Governance-aligned NEO staking through the live PlatformAnchor mode 1 pool, with variable GAS rewards and explicit confirmation recovery.",
  icon: "shield-check",
  category: "governance",
  shell: "launcher",
  directPlay: true,
  theme: {
    family: "finance",
    accentColor: "#087f5b",
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
    governance: true,
  },
};
