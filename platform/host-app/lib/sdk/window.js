import { createMiniAppSDK } from "./client.js";
export function installMiniAppSDK(cfg) {
    const sdk = createMiniAppSDK(cfg);
    window.MiniAppSDK = sdk;
}
