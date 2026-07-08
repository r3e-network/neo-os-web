/**
 * Neo blockchain utilities — re-exported from the framework canonical.
 *
 * The implementation moved to framework/utils/neo.ts (S0 utils
 * consolidation); this file keeps existing `@shared/utils/neo` imports
 * working with the SAME function identities.
 */

export {
  parseHash160,
  parseStackItem,
  parseInvokeResult,
  addressToScriptHash,
  normalizeScriptHash,
  ownerMatchesAddress,
} from "../../../framework/utils/neo";
