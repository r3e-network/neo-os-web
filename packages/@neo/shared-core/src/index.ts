/**
 * @neo/shared-core - Cross-platform shared utilities
 *
 * Platform-specific entry points:
 * - index.web.ts - Web platform (Next.js, uni-app H5)
 * - index.native.ts - React Native platform (Expo)
 */

// Re-export all shared utilities
export * from "./utils";
export * from "./types";

// Platform-agnostic exports
export { VERSION } from "./version";
