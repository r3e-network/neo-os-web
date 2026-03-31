/**
 * Shared Composables for Miniapps
 *
 * Provides reusable logic patterns for common miniapp operations.
 */

export { useContractAddress } from "./useContractAddress";
export { useErrorHandler } from "./useErrorHandler";
export type { ErrorCategory, ErrorContext, ErrorHandlerState } from "./useErrorHandler";
export { useI18n, createUseI18n } from "./useI18n";
export { useAllEvents } from "./useAllEvents";
export { useStatusMessage } from "./useStatusMessage";
export type { StatusMessage, StatusType } from "./useStatusMessage";
export { useTicker } from "./useTicker";
export type { UseTickerOptions } from "./useTicker";
export { useContractInteraction } from "./useContractInteraction";
export type { ContractInteractionOptions } from "./useContractInteraction";

// Advanced platform capabilities (AA, Oracle, Keeper)
export { useAbstractAccount } from "./useAbstractAccount";
export type { AAConfig } from "./useAbstractAccount";
export { useOracle } from "./useOracle";
export type { OracleConfig, VRFResult, TEEResult } from "./useOracle";

// Focused Oracle sub-composables (also available via useOracle barrel)
export { useVRF } from "./useVRF";
export { useDataFeed } from "./useDataFeed";
export { useOracleQuery } from "./useOracleQuery";
export { useCompute } from "./useCompute";
