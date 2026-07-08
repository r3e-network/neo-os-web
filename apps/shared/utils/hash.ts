/**
 * SHA-256 hex helpers — re-exported from the framework canonical.
 *
 * The implementation moved to framework/utils/hash.ts (S0 utils
 * consolidation); this file keeps existing `@shared/utils/hash` imports
 * working with the SAME function identities.
 */

export { sha256Hex, sha256HexFromHex } from "../../../framework/utils/hash";
