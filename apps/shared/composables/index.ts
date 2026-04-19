/**
 * Shared Composables for Miniapps
 *
 * Provides reusable logic patterns for common miniapp operations.
 */

export { useContractAddress } from "./useContractAddress";
export { useI18n, createUseI18n } from "./useI18n";
export { useAllEvents } from "./useAllEvents";
export { useStatusMessage } from "./useStatusMessage";
export type { StatusMessage, StatusType } from "./useStatusMessage";
export { useTicker } from "./useTicker";
export type { UseTickerOptions } from "./useTicker";
export { useContractInteraction } from "./useContractInteraction";
export type { ContractInteractionOptions } from "./useContractInteraction";

// Advanced platform capabilities
export { useAbstractAccount } from "./useAbstractAccount";
export type { AAConfig } from "./useAbstractAccount";

// On-chain Morpheus DataFeed reader (replaces the old off-chain
// useDataFeed/useOracle/useVRF/useOracleQuery/useCompute composables —
// the platform now reads oracle data directly from the deployed Morpheus
// contracts via JSON-RPC, with VRF/HTTP-query/compute mediated by
// flagship contracts on-chain rather than HTTP shortcuts to a TEE).
export { useMorpheusDataFeed } from "./useMorpheusDataFeed";
export type {
  UseMorpheusDataFeedConfig,
  MorpheusDataFeedHandle,
} from "./useMorpheusDataFeed";
