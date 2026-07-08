/**
 * Formatting utilities — re-exported from the framework canonical.
 *
 * The implementation moved to framework/utils/format.ts (S0 utils
 * consolidation); this file keeps existing `@shared/utils/format` imports
 * working with the SAME function identities.
 */

export {
  formatNumber,
  formatGas,
  formatFixed8,
  parseGas,
  fromFixed8,
  toFixedDecimals,
  parsePositiveFixedDecimals,
  parsePositiveFixed8,
  toFixed8,
  formatAddress,
  formatCountdown,
  hexToBytes,
  bytesToHex,
  randomIntFromBytes,
  formatHash,
  sleep,
  toSafeNumber,
  formatCompactNumber,
  formatNum,
  formatCurrency,
  STAT_PLACEHOLDER,
  formatStat,
} from "../../../framework/utils/format";
