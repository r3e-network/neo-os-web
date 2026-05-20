/**
 * Back-compat barrel — errorHandling.ts used to bundle error classes and
 * async helpers. Both groups now live in dedicated files (./errors and
 * ./async-utils). New code should import from those directly; this file
 * exists only to keep direct `@shared/utils/errorHandling` imports working.
 */

export {
  MiniAppError,
  WalletConnectionError,
  ContractError,
  TransactionError,
  InsufficientBalanceError,
  NetworkError,
  ValidationError,
  isMiniAppError,
  formatErrorMessage,
  createStatusRef,
} from "./errors";

export {
  handleAsync,
  handleContractOperation,
  withTimeout,
  retryAsync,
  pollForEvent,
  safeAsync,
} from "./async-utils";
