export {
    getLaunchParam,
    parseMiniAppLaunchContext,
    readMiniAppLaunchContext,
} from "./launch-params";
export type {
    MiniAppLaunchContext,
    MiniAppLaunchNetwork,
} from "./launch-params";

export function readQueryParam(key: string): string | null {
    if (typeof window === "undefined") return null;
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get(key);
}
