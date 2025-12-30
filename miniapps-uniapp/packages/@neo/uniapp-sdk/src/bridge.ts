/**
 * SDK Bridge - Connects uni-app to Neo MiniApp SDK
 */

import type { MiniAppSDK, NeoSDKConfig } from "./types";

declare global {
  interface Window {
    MiniAppSDK?: MiniAppSDK;
  }
}

/**
 * Wait for SDK to be ready
 */
export function waitForSDK(timeout = 5000): Promise<MiniAppSDK> {
  return new Promise((resolve, reject) => {
    if (window.MiniAppSDK) {
      resolve(window.MiniAppSDK);
      return;
    }

    const timer = setTimeout(() => {
      reject(new Error("SDK timeout"));
    }, timeout);

    const handler = () => {
      clearTimeout(timer);
      window.removeEventListener("miniapp-sdk-ready", handler);
      if (window.MiniAppSDK) {
        resolve(window.MiniAppSDK);
      } else {
        reject(new Error("SDK not found"));
      }
    };

    window.addEventListener("miniapp-sdk-ready", handler);
  });
}

/**
 * Create SDK bridge for H5 platform
 */
export function createH5Bridge(config: NeoSDKConfig): Promise<MiniAppSDK> {
  if (config.debug) {
    console.log("[Neo] Creating H5 bridge for:", config.appId);
  }
  return waitForSDK();
}

/**
 * Get SDK instance (sync, may be null)
 */
export function getSDKSync(): MiniAppSDK | null {
  return window.MiniAppSDK ?? null;
}
