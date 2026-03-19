/**
 * Shared Composables for Miniapps
 *
 * Provides reusable logic patterns for common miniapp operations.
 */

export { useChainValidation, isEvmChain, requireNeoChain } from "./useChainValidation";
export { useTheme, getThemeVariable, setThemeVariable, useThemeStyle } from "./useTheme";
export { useContractAddress } from "./useContractAddress";
export { useGameState } from "./useGameState";
export { usePaymentFlow } from "./usePaymentFlow";
export type { PaymentFlowOptions } from "./usePaymentFlow";
export { useErrorHandler } from "./useErrorHandler";
export type { ErrorCategory, ErrorContext, ErrorHandlerState } from "./useErrorHandler";
export { useCrypto } from "./useCrypto";
export { useI18n, createUseI18n } from "./useI18n";
export { useResponsive } from "./useResponsive";
export { useAllEvents } from "./useAllEvents";
export { useStatusMessage } from "./useStatusMessage";
export type { StatusMessage, StatusType } from "./useStatusMessage";
export { useAppInit } from "./useAppInit";
export { useTicker } from "./useTicker";
export type { UseTickerOptions } from "./useTicker";
export { useContractInteraction } from "./useContractInteraction";
export type { ContractInteractionOptions } from "./useContractInteraction";

// Advanced platform capabilities (AA, Oracle, Keeper)
export { useAbstractAccount } from "./useAbstractAccount";
export type { AAConfig, SessionKey } from "./useAbstractAccount";
export { useOracle } from "./useOracle";
export type { OracleConfig, VRFResult, TEEResult } from "./useOracle";
export { useKeeper } from "./useKeeper";
export type { KeeperConfig, KeeperTask } from "./useKeeper";
