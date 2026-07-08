/**
 * NEO / GAS amount-input helpers — re-exported from the framework canonical.
 *
 * The implementation moved to framework/utils/amounts.ts (S0 utils
 * consolidation); this file keeps existing `@shared/utils/amounts` imports
 * working with the SAME function identities. Error semantics are unchanged:
 * these return `0n` on invalid input, while `app.amount.gasToFixed8`
 * (framework/index.ts) still THROWS — the two variants are deliberately
 * NOT unified (see plan §S6).
 */

export {
  GAS_DECIMALS_MULTIPLIER,
  gasToBaseUnits,
  neoToInteger,
  amountToBaseUnits,
} from "../../../framework/utils/amounts";
