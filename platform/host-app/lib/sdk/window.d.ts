import type { MiniAppSDK, MiniAppSDKConfig } from "./types.js";
declare global {
    interface Window {
        MiniAppSDK?: MiniAppSDK;
    }
}
export declare function installMiniAppSDK(cfg: MiniAppSDKConfig): void;
