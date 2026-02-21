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

/**
 * Call a bridge method on the host SDK via postMessage.
 * Returns the result payload or throws on timeout/error.
 */
export function callBridge(method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const id = `bridge_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const expectedOrigin = window.location.ancestorOrigins?.[0] || "";
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error(`bridge call "${method}" timed out`));
    }, 5000);

    if (!expectedOrigin) {
      clearTimeout(timeout);
      reject(new Error("bridge origin unknown - cannot verify message source"));
      return;
    }

    function handler(event: MessageEvent) {
      if (event.origin !== expectedOrigin) return;
      if (event.data?.type === "bridge-response" && event.data?.id === id) {
        clearTimeout(timeout);
        window.removeEventListener("message", handler);
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data.result ?? {});
        }
      }
    }

    window.addEventListener("message", handler);
    window.parent.postMessage({ type: "bridge-call", id, method, params }, expectedOrigin);
  });
}
