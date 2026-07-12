import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Forever Album",
  description: "A wallet-scoped photo album kept only on this device, with optional AES-GCM encryption",
  icon: "camera",
  category: "social",
  shell: "launcher",
  features: { walletRequired: true, chainWarning: false },
  permissions: {},
};
