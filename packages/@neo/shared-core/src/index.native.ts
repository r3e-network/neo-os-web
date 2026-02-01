/**
 * React Native platform entry point
 * Used by: Expo (mobile-wallet)
 */

export * from "./utils";
export * from "./types";
export { VERSION } from "./version";

// React Native-specific exports
export const PLATFORM = "native" as const;
