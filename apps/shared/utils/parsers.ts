/**
 * Defensive parsers — re-exported from the framework canonical.
 *
 * The implementation moved to framework/utils/parsers.ts (S0 utils
 * consolidation); this file keeps existing `@shared/utils/parsers` imports
 * working with the SAME function identities.
 */

export {
  parseBigInt,
  parseBool,
  encodeTokenId,
  parseDateInput,
} from "../../../framework/utils/parsers";
