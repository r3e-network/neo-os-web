import { createMiniAppSDK } from "./client.js";
import type { MiniAppSDK, MiniAppSDKConfig } from "./types.js";

declare global {
  interface Window {
    MiniAppSDK?: MiniAppSDK;
  }
}

export function installMiniAppSDK(cfg: MiniAppSDKConfig): void {
  if (typeof window === "undefined") return;
  const sdk = createMiniAppSDK(cfg);
  window.MiniAppSDK = sdk;
  window.dispatchEvent(new Event("miniapp-sdk-ready"));
}

