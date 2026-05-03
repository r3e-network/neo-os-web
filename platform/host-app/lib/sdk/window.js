import { createMiniAppSDK } from "./client.js";
export function installMiniAppSDK(cfg) {
    if (typeof window === "undefined")
        return;
    const sdk = createMiniAppSDK(cfg);
    window.MiniAppSDK = sdk;
    window.dispatchEvent(new Event("miniapp-sdk-ready"));
}
