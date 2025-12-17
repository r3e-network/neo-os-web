import { createMiniAppSDK } from "./client.js";
import type { MiniAppSDKConfig } from "./types.js";

declare global {
  interface Window {
    MiniAppSDK?: unknown;
  }
}

export function installMiniAppSDK(cfg: MiniAppSDKConfig): void {
  const sdk = createMiniAppSDK(cfg);
  window.MiniAppSDK = sdk;
}

