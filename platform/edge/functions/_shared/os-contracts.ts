/**
 * Centralized OS contract configuration.
 *
 * ARCHITECTURE DECISION (audit finding E-8, resolved 2026-05-19):
 * The canonical OS architecture is a SINGLE KERNEL contract addressed by
 * `CONTRACT_MORPHEUS_ORACLE_HASH` (see `_shared/kernel-rpc.ts:getKernelHash`).
 * All 41 OS edge functions route writes through that kernel. The kernel
 * exposes per-service operations (`PlaceBet`, `DefineBadge`, `CreateStream`,
 * `Mint`, `GetMiniAppState`, etc.).
 *
 * The per-service `OS_CONTRACTS.*` map below is **legacy / optional fallback**
 * — it predates the kernel migration and remains for documentation parity
 * with `.env.example`. The values in `.env.example` correspond to historical
 * per-service deployments; new code should NOT add references to
 * `OS_CONTRACTS.*`. If a future architecture splits the kernel back into
 * per-service contracts, this map is the place to wire them up; until then
 * treat it as informational.
 */

import { getEnv } from "./env.ts";

function getContractHash(key: string, fallback = ""): string {
  return getEnv(key) ?? fallback;
}

/** OS Service contract hashes -- read once, used everywhere.
 *
 * Audit fix E-5: env var names previously had extra underscores
 * (`CONTRACT_STORAGE_SERVICE_HASH`) that did NOT match what `.env.example`
 * and `.env` actually export (`CONTRACT_STORAGESERVICE_HASH`). All fields
 * resolved to "" at runtime, which would have broken any future migration
 * to this central source-of-truth. Each field now reads the env name shipped
 * in `.env.example` first, falling back to the legacy underscore-separated
 * name for forward compatibility.
 */
function getServiceHash(canonical: string, legacy: string): string {
  return getEnv(canonical) ?? getEnv(legacy) ?? "";
}

export const OS_CONTRACTS = {
  storage:      getServiceHash("CONTRACT_STORAGESERVICE_HASH",      "CONTRACT_STORAGE_SERVICE_HASH"),
  payment:      getServiceHash("CONTRACT_PAYMENTSERVICE_HASH",      "CONTRACT_PAYMENT_SERVICE_HASH"),
  scriptEngine: getServiceHash("CONTRACT_SCRIPTENGINE_HASH",        "CONTRACT_SCRIPT_ENGINE_HASH"),
  checkin:      getServiceHash("CONTRACT_CHECKINSERVICE_HASH",      "CONTRACT_CHECKIN_SERVICE_HASH"),
  badge:        getServiceHash("CONTRACT_BADGESERVICE_HASH",        "CONTRACT_BADGE_SERVICE_HASH"),
  leaderboard:  getServiceHash("CONTRACT_LEADERBOARDSERVICE_HASH",  "CONTRACT_LEADERBOARD_SERVICE_HASH"),
  vesting:      getServiceHash("CONTRACT_VESTINGSERVICE_HASH",      "CONTRACT_VESTING_SERVICE_HASH"),
  game:         getServiceHash("CONTRACT_GAMESERVICE_HASH",         "CONTRACT_GAME_SERVICE_HASH"),
  escrow:       getServiceHash("CONTRACT_ESCROWSERVICE_HASH",       "CONTRACT_ESCROW_SERVICE_HASH"),
  nft:          getServiceHash("CONTRACT_NFTSERVICE_HASH",          "CONTRACT_NFT_SERVICE_HASH"),
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
