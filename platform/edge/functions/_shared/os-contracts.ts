/**
 * Centralized OS contract configuration.
 * Single source of truth for all OS service contract hashes and RPC endpoints.
 *
 * Instead of each edge function independently calling getEnv("CONTRACT_*_HASH"),
 * import from here:
 *
 *   import { OS_CONTRACTS } from "../_shared/os-contracts.ts";
 *   // then use OS_CONTRACTS.storage, OS_CONTRACTS.payment, etc.
 *
 * Migration guide (for remaining ~40 functions):
 *   1. Replace:  import { getEnv } from "../_shared/env.ts";
 *                const CONTRACT_HASH = getEnv("CONTRACT_STORAGE_SERVICE_HASH") ?? "";
 *      With:     import { OS_CONTRACTS } from "../_shared/os-contracts.ts";
 *                // then use OS_CONTRACTS.storage in place of CONTRACT_HASH
 *
 *   2. For payment functions that also need GAS hash:
 *                import { OS_CONTRACTS, NATIVE_CONTRACTS } from "../_shared/os-contracts.ts";
 *                // use NATIVE_CONTRACTS.gas instead of inline NEO_TESTNET_GAS_HASH
 */

import { getEnv } from "./env.ts";

function getContractHash(key: string, fallback = ""): string {
  return getEnv(key) ?? fallback;
}

/** OS Service contract hashes -- read once, used everywhere */
export const OS_CONTRACTS = {
  storage: getContractHash("CONTRACT_STORAGE_SERVICE_HASH"),
  payment: getContractHash("CONTRACT_PAYMENT_SERVICE_HASH"),
  scriptEngine: getContractHash("CONTRACT_SCRIPT_ENGINE_HASH"),
  checkin: getContractHash("CONTRACT_CHECKIN_SERVICE_HASH"),
  badge: getContractHash("CONTRACT_BADGE_SERVICE_HASH"),
  leaderboard: getContractHash("CONTRACT_LEADERBOARD_SERVICE_HASH"),
  vesting: getContractHash("CONTRACT_VESTING_SERVICE_HASH"),
  game: getContractHash("CONTRACT_GAME_SERVICE_HASH"),
  escrow: getContractHash("CONTRACT_ESCROW_SERVICE_HASH"),
  nft: getContractHash("CONTRACT_NFT_SERVICE_HASH"),
} as const;

/** Platform contract hashes */
export const PLATFORM_CONTRACTS = {
  appRegistry: getContractHash("CONTRACT_APPREGISTRY_HASH"),
  governance: getContractHash("CONTRACT_GOVERNANCE_HASH"),
  pauseRegistry: getContractHash("CONTRACT_PAUSEREGISTRY_HASH"),
  oracleService: getContractHash("CONTRACT_ORACLESERVICE_HASH"),
  automationAnchor: getContractHash("CONTRACT_AUTOMATIONANCHOR_HASH"),
  randomnessLog: getContractHash("CONTRACT_RANDOMNESSLOG_HASH"),
} as const;

/** Neo N3 native contract hashes */
export const NATIVE_CONTRACTS = {
  gas: getContractHash("CONTRACT_GAS_HASH", "0xd2a4cff31913016155e38e474a2c06d08be276cf"),
  neo: getContractHash("CONTRACT_NEO_HASH", "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5"),
} as const;
