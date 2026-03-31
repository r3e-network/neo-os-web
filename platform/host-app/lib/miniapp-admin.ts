/**
 * Barrel re-export for miniapp admin modules.
 *
 * All functionality has been split into focused files:
 *   - miniapp-permissions.ts  — field normalization, validation helpers, coercion utilities
 *   - miniapp-blueprints.ts   — blueprint definitions, lookup, listing
 *   - miniapp-registration.ts — payload normalization, manifest hashing, upsert row building
 *
 * This file re-exports the public API so existing consumers are unaffected.
 */

// --- Types ---
export type { MiniAppBlueprint, MiniAppAdminAction } from "./miniapp-blueprints";
export type { MiniAppUpsertRow, NormalizeMiniAppAdminPayloadResult } from "./miniapp-registration";

// --- Blueprints ---
export { listMiniAppBlueprints } from "./miniapp-blueprints";

// --- Registration / manifest ---
export { computeManifestHashHex, normalizeMiniAppAdminPayload } from "./miniapp-registration";
