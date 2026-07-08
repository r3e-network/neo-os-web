/**
 * Miniapp error hierarchy — re-exported from the framework canonical.
 *
 * The implementation moved to framework/utils/errors.ts (S0 utils
 * consolidation); this file keeps existing `@shared/utils/errors` imports
 * working with the SAME class identities, so `instanceof MiniAppError`
 * checks keep matching errors thrown from framework code.
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
} from "../../../framework/utils/errors";
