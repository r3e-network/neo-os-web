/**
 * Multi-Chain Configuration Module
 *
 * Exports all chain-related types, configurations, and utilities.
 */

// Types
export * from "./types";

// Default configurations
export * from "./defaults";

// Registry
export { chainRegistry, getChainRegistry } from "./registry";
export type { IChainRegistry } from "./registry";

// Hooks
export { useChains } from "./hooks";

// RPC Client (class-based)
export { ChainRPCClient, getRPCClient } from "./rpc-client";

// RPC Functions (functional API, migrated from lib/chain/)
export {
  rpcCall,
  invokeRead,
  getBlockCount,
  getApplicationLog,
  getChainRpcUrl,
  setChainRpcUrl,
  getChainTypeFromId,
  isNeoN3ChainId,
  chainRpcCall,
  getBlockCountMultiChain,
  getTransactionLogMultiChain,
} from "./rpc-functions";
export type { RpcRequest, RpcResponse, InvokeResult, StackItem } from "./rpc-functions";

// Contract Queries (migrated from lib/chain/)
export {
  CONTRACTS,
  getContractAddress,
  isContractOnChain,
  getContractChains,
  getLotteryState,
  getGameState,
  getVotingState,
  getContractStats,
  parseInteger,
  parseString,
} from "./contract-queries";
export type { LotteryState, GameState, VotingState, ContractStats } from "./contract-queries";

// Chain Services
export type { IChainService } from "./service-interface";
export { NeoN3ChainService } from "./neo-service";
export { createChainService, getServiceForChain, clearServiceCache } from "./service-factory";
