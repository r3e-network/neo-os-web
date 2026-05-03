/**
 * Shared utilities index
 *
 * Named re-exports for tree-shaking. Using `export *` defeats tree-shaking
 * because bundlers cannot statically determine which symbols are unused.
 * Each module's public API is explicitly listed so that miniapps pulling
 * from "@shared/utils" only bundle the symbols they actually reference.
 *
 * Preferred import style for miniapps:
 *   import { formatGas } from "@shared/utils/format";
 * Barrel import still works but now tree-shakes correctly:
 *   import { formatGas } from "@shared/utils";
 */

// format.ts
export {
  formatNumber,
  formatGas,
  formatFixed8,
  parseGas,
  fromFixed8,
  toFixedDecimals,
  toFixed8,
  formatAddress,
  formatCountdown,
  hexToBytes,
  bytesToHex,
  randomIntFromBytes,
  formatHash,
  sleep,
  formatCompactNumber,
  formatNum,
  formatCurrency,
  toSafeNumber,
} from "./format";

// neo.ts
export {
  parseStackItem,
  parseInvokeResult,
  addressToScriptHash,
  normalizeScriptHash,
  ownerMatchesAddress,
} from "./neo";

// chain.ts
export { isEvmChain, requireNeoChain } from "./chain";

// errorHandling.ts
export {
  MiniAppError,
  WalletConnectionError,
  ContractError,
  TransactionError,
  InsufficientBalanceError,
  NetworkError,
  ValidationError,
  isMiniAppError,
  handleAsync,
  handleContractOperation,
  createStatusRef,
  formatErrorMessage,
  withTimeout,
  retryAsync,
  pollForEvent,
  safeAsync,
} from "./errorHandling";

// transaction.ts
export {
  extractTxid,
  isTxEventPendingError,
  waitForEventByTransaction,
  pollForTxEvent,
  waitForListedEventByTransaction,
} from "./transaction";
export type { PollForTxEventParams, WaitForListedEventByTransactionParams } from "./transaction";

// theme.ts
export { getTheme, setTheme, initTheme, listenForThemeChanges } from "./theme";
export type { Theme } from "./theme";

// hash.ts
export { sha256Hex, sha256HexFromHex } from "./hash";

// parsers.ts
export { parseBigInt, parseBool, encodeTokenId, parseDateInput } from "./parsers";

// createSidebarItems.ts
export { createSidebarItems } from "./createSidebarItems";

// createMiniAppEntry.ts
export { createMiniAppEntry } from "./createMiniAppEntry";

// n3index.ts — re-export all public API functions, types, and constants
export type {
  Network,
  NetworkStatus,
  NetworkSummary,
  AccountInfo,
  AccountTransaction,
  ContractInfo,
  ContractEvent,
  TokenInfo,
  ValidatorInfo,
} from "./n3index";
export {
  healthCheck,
  getNetworkStatus,
  getNetworkSummary,
  getAccount,
  getAccountTransactions,
  getContract,
  getContractEvents,
  getToken,
  getDailyAnalytics,
  getValidators,
  getContractMetadata,
  getAddressMetadata,
  restQuery,
  getBlocks,
  getTransactions,
  getNep17Transfers,
  getNep11Transfers,
  restContractEvents,
  getNep17Balances,
  restDailyAnalytics,
  waitForTransaction,
  N3INDEX_API,
} from "./n3index";

// runtime-cache.ts
export {
  readCachedJSON,
  writeCachedJSON,
  clearCachedValue,
  readTimedCache,
  readTimedCacheValue,
  writeTimedCache,
} from "./runtime-cache";

// runtime-origin.ts
export { getHostOrigin } from "./runtime-origin";

// createActionHandlers.ts
export { registerActions } from "./createActionHandlers";
export type { ActionDef } from "./createActionHandlers";
