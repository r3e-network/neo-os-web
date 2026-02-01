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

// RPC Client
export { ChainRPCClient, getRPCClient } from "./rpc-client";

// Chain Services
export type { IChainService } from "./service-interface";
export { NeoN3ChainService } from "./neo-service";
export { createChainService, getServiceForChain, clearServiceCache } from "./service-factory";
