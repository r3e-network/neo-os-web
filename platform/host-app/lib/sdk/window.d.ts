import type { MiniAppSDKConfig } from "./types.js";
declare global {
    interface Window {
        MiniAppSDK?: unknown;
    }
}
export declare function installMiniAppSDK(cfg: MiniAppSDKConfig): void;
