/**
 * Shared Composables for Miniapps
 *
 * Provides reusable logic patterns for common miniapp operations.
 */

export {
  useChainValidation,
  isEvmChain,
  requireNeoChain,
} from "./useChainValidation";
export {
  useTheme,
  getThemeVariable,
  setThemeVariable,
  useThemeStyle,
} from "./useTheme";
export { usePageState } from "./usePageState";
export { useContractInteraction } from "./useContractInteraction";
export { useFormState } from "./useFormState";
export { useGameState } from "./useGameState";
export { usePaymentFlow } from "./usePaymentFlow";
export { useAsyncOperation } from "./useAsyncOperation";
export { useErrorHandler } from "./useErrorHandler";
export type { ErrorCategory, ErrorContext, ErrorHandlerState } from "./useErrorHandler";
export { useCrypto } from "./useCrypto";
