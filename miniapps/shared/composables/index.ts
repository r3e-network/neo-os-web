/**
 * Shared Composables for Miniapps
 *
 * Provides reusable logic patterns for common miniapp operations.
 */

export { useChainValidation, isEvmChain, requireNeoChain } from "./useChainValidation";
export { useTheme, getThemeVariable, setThemeVariable, useThemeStyle } from "./useTheme";
export { useContractAddress } from "./useContractAddress";
export { useFormState } from "./useFormState";
export { useGameState } from "./useGameState";
export { usePaymentFlow } from "./usePaymentFlow";
export type { PaymentFlowOptions } from "./usePaymentFlow";
export { useErrorHandler } from "./useErrorHandler";
export type { ErrorCategory, ErrorContext, ErrorHandlerState } from "./useErrorHandler";
export { useCrypto } from "./useCrypto";
export { useI18n, createUseI18n } from "./useI18n";
export { useListDetail } from "./useListDetail";
export { useResponsive } from "./useResponsive";
export { useAllEvents } from "./useAllEvents";
export { useStatusMessage } from "./useStatusMessage";
export type { StatusMessage, StatusType } from "./useStatusMessage";
export { useAppInit } from "./useAppInit";
export { useHandleBoundaryError } from "./useHandleBoundaryError";
export { useTicker } from "./useTicker";
export type { UseTickerOptions } from "./useTicker";
