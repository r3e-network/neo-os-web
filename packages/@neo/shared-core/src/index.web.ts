/**
 * Web platform entry point
 * Used by: Next.js (host-app), uni-app H5 (miniapps)
 */

export * from "./utils";
export * from "./types";
export { VERSION } from "./version";

// Web-specific exports
export const PLATFORM = "web" as const;
