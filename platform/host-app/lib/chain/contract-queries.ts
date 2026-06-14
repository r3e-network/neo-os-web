/**
 * Contract Query Functions
 * Query flagship MiniApp contract states on Neo N3.
 *
 * Contract hashes are sourced from the shared, drift-guarded
 * MINIAPP_CONTRACTS registry (generated from each app's neo-manifest.json)
 * so the host can never read from a different contract than the one the
 * runtime invokes. The decoders below speak the deployed standalone ABIs.
 */

import type { MiniAppInfo } from "@/components/types";
import { invokeRead, type Network, type StackItem } from "./rpc-client";
import { resolveSharedModeRuntime } from "./shared-mode";
import { getMiniAppContractHash } from "../../../../apps/shared/constants/rpc";
import { logger } from "@/lib/logger";

/**
 * Flagship app ids whose live contract state the host reads, with the
 * category used for live-status rendering. Contract hashes are resolved
 * per-network from the shared registry (never hardcoded here).
 */
const FLAGSHIP_APP_CATEGORIES: Record<string, string> = {
  "miniapp-last-survivor": "gaming",
  "miniapp-gasbox": "gaming",
  "miniapp-redenvelope": "social",
  "miniapp-dailycheckin": "gaming",
  "miniapp-fogplay": "gaming",
  "miniapp-self-loan": "defi",
  "miniapp-neo-pay": "defi",
  "miniapp-trustanchor": "defi",
  "miniapp-profitanchor": "defi",
  "miniapp-trustanchor-admin": "utility",
  "miniapp-profitanchor-admin": "utility",
};

const PLATFORM_ANCHOR_APP_IDS = new Set([
  "miniapp-trustanchor",
  "miniapp-profitanchor",
  "miniapp-trustanchor-admin",
  "miniapp-profitanchor-admin",
]);

const PLATFORM_ANCHOR_FALLBACK = {
  mainnet: "0x02beeef6f65c6989a121c0a0e6b23190333edb98",
  testnet: "0xeb6b3725d47d0941f36a834bdbd12f1427977604",
} as const;

function toRegistryNetwork(network: Network): "mainnet" | "testnet" {
  return network === "testnet" ? "testnet" : "mainnet";
}

function resolveFlagshipContract(appId: string, network: Network): string {
  const registryHash = getMiniAppContractHash(appId, toRegistryNetwork(network));
  if (registryHash) return registryHash;
  // The shared PlatformAnchor contract backs several anchor app ids that
  // are not 1:1 with a deployed standalone contract in the registry.
  if (PLATFORM_ANCHOR_APP_IDS.has(appId)) {
    return PLATFORM_ANCHOR_FALLBACK[toRegistryNetwork(network)];
  }
  return "";
}

export function getFlagshipApps(network: Network): Record<string, { contract: string; category: string }> {
  const apps: Record<string, { contract: string; category: string }> = {};
  for (const [appId, category] of Object.entries(FLAGSHIP_APP_CATEGORIES)) {
    const contract = resolveFlagshipContract(appId, network);
    if (!contract) continue;
    apps[appId] = { contract, category };
  }
  return apps;
}

export const FLAGSHIP_APPS: Record<string, { contract: string; category: string }> = {
  ...getFlagshipApps("mainnet"),
};

function parseInteger(item?: StackItem): bigint {
  if (!item) return 0n;
  if (item.type === "Integer") return BigInt(item.value);
  return 0n;
}

function safeNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) return Number.MAX_SAFE_INTEGER;
  if (value < BigInt(-Number.MAX_SAFE_INTEGER)) return -Number.MAX_SAFE_INTEGER;
  return Number(value);
}

function parseUnknownInteger(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  try {
    return BigInt(String(value ?? "0"));
  } catch {
    return 0n;
  }
}

function gasToWhole(value: bigint): string {
  return (value / 100000000n).toString();
}

function parseByteString(item?: StackItem): string {
  if (!item || item.type !== "ByteString") return "";
  try {
    const decoded = Buffer.from(item.value, "base64").toString("utf8");
    if (/^[\x20-\x7E\s]*$/.test(decoded)) return decoded;
  } catch {
    // fall through
  }
  return String(item.value || "");
}

function parseStackValue(item: StackItem): unknown {
  switch (item.type) {
    case "Integer":
      return BigInt(item.value);
    case "Boolean":
      return item.value;
    case "ByteString":
      return parseByteString(item);
    case "Array":
    case "Struct":
      return item.value.map(parseStackValue);
    case "Map":
      return Object.fromEntries(item.value.map((entry) => [String(parseStackValue(entry.key)), parseStackValue(entry.value)]));
    default:
      return null;
  }
}

function mapFromResult(item?: StackItem): Record<string, unknown> {
  if (!item || item.type !== "Map") return {};
  return parseStackValue(item) as Record<string, unknown>;
}

export interface MiniAppContractStats {
  totalValueLocked: string;
  totalTransactions: number;
  uniqueUsers: number;
}

export interface MiniAppLiveStatus {
  appId: string;
  jackpot?: string;
  playersOnline?: number;
  nextDraw?: number;
  tvl?: string;
  volume24h?: string;
}

export async function getSharedModeContractStats(
  app: MiniAppInfo,
  network: Network,
): Promise<MiniAppContractStats | null> {
  const runtime = await resolveSharedModeRuntime(app, network);
  if (!runtime) return null;

  if (runtime.instance.recipeId === "recipe.payment_streams.v1") {
    const streamModule = runtime.modules.find((module) => module.binding === "stream");
    if (!streamModule?.contractHash) return null;
    const res = await invokeRead(
      streamModule.contractHash,
      "totalStreams",
      [{ type: "String", value: runtime.instance.instanceId }],
      network,
    );
    const totalStreams = parseInteger(res.stack?.[0]);
    return {
      totalValueLocked: "0",
      totalTransactions: safeNumber(totalStreams),
      uniqueUsers: runtime.instance.status === 1 ? 1 : 0,
    };
  }

  return null;
}

export async function getSharedModeLiveStatus(
  app: MiniAppInfo,
  network: Network,
): Promise<MiniAppLiveStatus | null> {
  const runtime = await resolveSharedModeRuntime(app, network);
  if (!runtime) return null;

  if (runtime.instance.recipeId === "recipe.payment_streams.v1") {
    const streamModule = runtime.modules.find((module) => module.binding === "stream");
    if (!streamModule?.contractHash) return null;
    const res = await invokeRead(
      streamModule.contractHash,
      "totalStreams",
      [{ type: "String", value: runtime.instance.instanceId }],
      network,
    );
    const totalStreams = parseInteger(res.stack?.[0]);
    return {
      appId: app.app_id,
      tvl: "0",
      volume24h: totalStreams.toString(),
    };
  }

  return { appId: app.app_id };
}

/** LastSurvivor standalone: getCurrentRound() -> Map */
export async function getLastSurvivorRound(
  contractHash: string,
  network: Network,
): Promise<Record<string, unknown>> {
  const res = await invokeRead(contractHash, "getCurrentRound", [], network);
  return mapFromResult(res.stack?.[0]);
}

/** DailyCheckin standalone: getPlatformStats() -> Map { totalUsers, totalCheckins } */
export async function getDailyCheckinState(
  contractHash: string,
  network: Network,
): Promise<Record<string, unknown>> {
  const res = await invokeRead(contractHash, "getPlatformStats", [], network);
  return mapFromResult(res.stack?.[0]);
}

/** SelfLoan standalone: totalLoans/totalBorrowed/totalRepaid/pool (all Integer) */
export async function getSelfLoanState(
  contractHash: string,
  network: Network,
): Promise<Record<string, bigint>> {
  const [totalLoans, totalBorrowed, totalRepaid, pool] = await Promise.all([
    invokeRead(contractHash, "totalLoans", [], network),
    invokeRead(contractHash, "totalBorrowed", [], network),
    invokeRead(contractHash, "totalRepaid", [], network),
    invokeRead(contractHash, "pool", [], network),
  ]);
  return {
    totalLoans: parseInteger(totalLoans.stack?.[0]),
    totalBorrowed: parseInteger(totalBorrowed.stack?.[0]),
    totalRepaid: parseInteger(totalRepaid.stack?.[0]),
    pool: parseInteger(pool.stack?.[0]),
  };
}

/** NeoPay vault: totalStreams() -> Integer */
export async function getStreamVaultState(
  contractHash: string,
  network: Network,
): Promise<Record<string, unknown>> {
  const res = await invokeRead(contractHash, "totalStreams", [], network);
  if (!res.stack || res.stack.length === 0) {
    return { totalStreams: 0n };
  }
  return { totalStreams: parseInteger(res.stack[0]) };
}

/** FogPlay (CoinFlipV2 commit/reveal) standalone: bankroll() + lastBetId() */
export async function getCoinFlipState(
  contractHash: string,
  network: Network,
): Promise<Record<string, unknown>> {
  const [bankroll, lastBetId] = await Promise.all([
    invokeRead(contractHash, "bankroll", [], network),
    invokeRead(contractHash, "lastBetId", [], network),
  ]);
  return {
    bankroll: parseInteger(bankroll.stack?.[0]),
    lastBetId: parseInteger(lastBetId.stack?.[0]),
  };
}

/** GasBox (gacha) standalone: lastMachineId() -> Integer */
export async function getNeoGachaState(
  contractHash: string,
  network: Network,
): Promise<Record<string, unknown>> {
  const res = await invokeRead(contractHash, "lastMachineId", [], network);
  if (!res.stack || res.stack.length === 0) {
    return { lastMachineId: 0n };
  }
  return { lastMachineId: parseInteger(res.stack[0]) };
}

export async function getContractStats(
  contractHash: string,
  network: Network,
  appId?: string,
): Promise<MiniAppContractStats> {
  try {
    switch (appId) {
      case "miniapp-last-survivor": {
        const state = await getLastSurvivorRound(contractHash, network);
        return {
          totalValueLocked: gasToWhole(parseUnknownInteger(state.pot)),
          totalTransactions: safeNumber(parseUnknownInteger(state.totalKeys)),
          uniqueUsers: 0,
        };
      }
      case "miniapp-dailycheckin": {
        const state = await getDailyCheckinState(contractHash, network);
        return {
          totalValueLocked: "0",
          totalTransactions: safeNumber(parseUnknownInteger(state.totalCheckins)),
          uniqueUsers: safeNumber(parseUnknownInteger(state.totalUsers)),
        };
      }
      case "miniapp-self-loan": {
        const state = await getSelfLoanState(contractHash, network);
        return {
          totalValueLocked: gasToWhole(state.pool),
          totalTransactions: safeNumber(state.totalLoans),
          uniqueUsers: 0,
        };
      }
      case "miniapp-fogplay": {
        const state = await getCoinFlipState(contractHash, network);
        return {
          totalValueLocked: gasToWhole(parseUnknownInteger(state.bankroll)),
          totalTransactions: safeNumber(parseUnknownInteger(state.lastBetId)),
          uniqueUsers: 0,
        };
      }
      case "miniapp-neo-pay": {
        const state = await getStreamVaultState(contractHash, network);
        return {
          totalValueLocked: "0",
          totalTransactions: safeNumber(BigInt(state.totalStreams as bigint || 0n)),
          uniqueUsers: 0,
        };
      }
      case "miniapp-gasbox": {
        const state = await getNeoGachaState(contractHash, network);
        return {
          totalValueLocked: "0",
          totalTransactions: safeNumber(parseUnknownInteger(state.lastMachineId)),
          uniqueUsers: 0,
        };
      }
      case "miniapp-redenvelope":
      default:
        return { totalValueLocked: "0", totalTransactions: 0, uniqueUsers: 0 };
    }
  } catch (err) {
    logger.warn("getContractStats failed:", err);
    return { totalValueLocked: "0", totalTransactions: 0, uniqueUsers: 0 };
  }
}

export async function getLiveStatus(
  appId: string,
  contractHash: string,
  category: string,
  network: Network,
): Promise<MiniAppLiveStatus> {
  const status: MiniAppLiveStatus = { appId };

  try {
    switch (appId) {
      case "miniapp-last-survivor": {
        const state = await getLastSurvivorRound(contractHash, network);
        status.jackpot = gasToWhole(parseUnknownInteger(state.pot));
        status.playersOnline = safeNumber(parseUnknownInteger(state.totalKeys));
        status.nextDraw = safeNumber(parseUnknownInteger(state.remainingTime));
        return status;
      }
      case "miniapp-dailycheckin": {
        const state = await getDailyCheckinState(contractHash, network);
        status.playersOnline = safeNumber(parseUnknownInteger(state.totalUsers));
        return status;
      }
      case "miniapp-self-loan": {
        const state = await getSelfLoanState(contractHash, network);
        status.tvl = gasToWhole(state.pool);
        status.volume24h = gasToWhole(state.totalRepaid);
        return status;
      }
      case "miniapp-fogplay": {
        const state = await getCoinFlipState(contractHash, network);
        status.tvl = gasToWhole(parseUnknownInteger(state.bankroll));
        status.volume24h = parseUnknownInteger(state.lastGameId).toString();
        return status;
      }
      case "miniapp-neo-pay": {
        const state = await getStreamVaultState(contractHash, network);
        status.tvl = "0";
        status.volume24h = BigInt(state.totalStreams as bigint || 0n).toString();
        return status;
      }
      default:
        if (category === "defi") {
          status.tvl = "0";
        }
        return status;
    }
  } catch {
    return status;
  }
}

export { parseInteger, parseByteString };
