import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Daily Check-in",
  description: "Protect a verified UTC-day streak and unlock live GAS milestones",
  icon: "check-circle",
  category: "game",
  shell: "launcher",
  tabs: [],
  stats: [],
  features: {
    fireworks: true,
    walletRequired: false,
    chainWarning: true,
  },
  docs: [],
  contract: {
    mode: "custom",
  },
  permissions: {
    payments: true,
  },
};
