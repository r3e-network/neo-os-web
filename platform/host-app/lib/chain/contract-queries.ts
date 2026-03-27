/**
 * Contract Query Functions
 * Query flagship MiniApp contract states on Neo N3.
 */

import type { MiniAppInfo } from "@/components/types";
import { invokeRead, type Network, type StackItem } from "./rpc-client";
import { resolveSharedModeRuntime } from "./shared-mode";
import { logger } from "@/lib/logger";

export const CONTRACTS = {
  lastSurvivor: "0x180a3a35c088eab4feded508c2ccb1556e07a840",
  gasBox: "0xf111a0d02ecae3ace271da8abeb7ee22fa122f1c",
  redEnvelope: "0x5f371cc50116bb13d79554d96ccdd6e246cd5d59",
  dailyCheckin: "0xbd4f3646e189350b9c11a659655854e6f03f9be4",
  fogPlay: "0xa5a4b5b82066d86eae9312f6072d1c3604882c81",
  selfLoan: "0x942da575b31f39cbb59e64b5813b128739b44c25",
  neoPay: "0xfd4dcc346d73c4ac6c3db209323561cf7f1b5e34",
} as const;

export const FLAGSHIP_APPS: Record<string, { contract: string; category: string }> = {
  "miniapp-last-survivor": { contract: CONTRACTS.lastSurvivor, category: "gaming" },
  "miniapp-gasbox": { contract: CONTRACTS.gasBox, category: "gaming" },
  "miniapp-redenvelope": { contract: CONTRACTS.redEnvelope, category: "social" },
  "miniapp-dailycheckin": { contract: CONTRACTS.dailyCheckin, category: "gaming" },
  "miniapp-fogplay": { contract: CONTRACTS.fogPlay, category: "gaming" },
  "miniapp-self-loan": { contract: CONTRACTS.selfLoan, category: "defi" },
  "miniapp-neo-pay": { contract: CONTRACTS.neoPay, category: "defi" },
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
  network: Network = "testnet",
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
  network: Network = "testnet",
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

export async function getDoomsdayState(
  contractHash: string = CONTRACTS.lastSurvivor,
  network: Network = "testnet",
): Promise<Record<string, unknown>> {
  const res = await invokeRead(contractHash, "getGameStatus", [], network);
  return mapFromResult(res.stack[0]);
}

export async function getDoomsdayPlatformStats(
  contractHash: string = CONTRACTS.lastSurvivor,
  network: Network = "testnet",
): Promise<Record<string, unknown>> {
  const res = await invokeRead(contractHash, "getPlatformStats", [], network);
  return mapFromResult(res.stack[0]);
}

export async function getDailyCheckinState(
  contractHash: string = CONTRACTS.dailyCheckin,
  network: Network = "testnet",
): Promise<Record<string, unknown>> {
  const res = await invokeRead(contractHash, "getPlatformStats", [], network);
  return mapFromResult(res.stack[0]);
}

export async function getSelfLoanState(
  contractHash: string = CONTRACTS.selfLoan,
  network: Network = "testnet",
): Promise<Record<string, unknown>> {
  const res = await invokeRead(contractHash, "getPlatformStats", [], network);
  return mapFromResult(res.stack[0]);
}

export async function getStreamVaultState(
  contractHash: string = CONTRACTS.neoPay,
  network: Network = "testnet",
): Promise<Record<string, unknown>> {
  const res = await invokeRead(contractHash, "totalStreams", [], network);
  if (!res.stack || res.stack.length === 0) {
    return { totalStreams: 0n };
  }
  return { totalStreams: parseInteger(res.stack[0]) };
}

export async function getCoinFlipState(
  contractHash: string = CONTRACTS.fogPlay,
  network: Network = "testnet",
): Promise<Record<string, unknown>> {
  const res = await invokeRead(contractHash, "getBetLimits", [], network);
  const values = Array.isArray(res.stack?.[0]?.value) ? (res.stack[0].value as StackItem[]) : [];
  return {
    maxBet: parseInteger(values[0]) || 0n,
    dailyLimit: parseInteger(values[1]) || 0n,
    cooldownSeconds: parseInteger(values[2]) || 0n,
    maxConsecutive: parseInteger(values[3]) || 0n,
  };
}

export async function getNeoGachaState(
  contractHash: string = CONTRACTS.gasBox,
  network: Network = "testnet",
): Promise<Record<string, unknown>> {
  const res = await invokeRead(contractHash, "totalMachines", [], network);
  if (!res.stack || res.stack.length === 0) {
    return { totalMachines: 0n };
  }
  return { totalMachines: parseInteger(res.stack[0]) };
}

export async function getContractStats(
  contractHash: string,
  network: Network = "testnet",
  appId?: string,
): Promise<MiniAppContractStats> {
  try {
    switch (appId) {
      case "miniapp-last-survivor": {
        const state = await getDoomsdayPlatformStats(contractHash, network);
        return {
          totalValueLocked: (BigInt((state.currentRoundPot as bigint) || 0n) / 100000000n).toString(),
          totalTransactions: safeNumber(BigInt((state.totalKeysSold as bigint) || 0n)),
          uniqueUsers: safeNumber(BigInt((state.totalPlayers as bigint) || 0n)),
        };
      }
      case "miniapp-dailycheckin": {
        const state = await getDailyCheckinState(contractHash, network);
        return {
          totalValueLocked: "0",
          totalTransactions: safeNumber(BigInt(state.totalCheckins as bigint || 0n)),
          uniqueUsers: safeNumber(BigInt(state.totalUsers as bigint || 0n)),
        };
      }
      case "miniapp-self-loan": {
        const state = await getSelfLoanState(contractHash, network);
        return {
          totalValueLocked: (BigInt(state.totalCollateral as bigint || 0n) / 100000000n).toString(),
          totalTransactions: safeNumber(BigInt(state.totalLoans as bigint || 0n)),
          uniqueUsers: safeNumber(BigInt(state.totalBorrowers as bigint || 0n)),
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
      case "miniapp-fogplay":
      case "miniapp-gasbox":
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
  network: Network = "testnet",
): Promise<MiniAppLiveStatus> {
  const status: MiniAppLiveStatus = { appId };

  try {
    switch (appId) {
      case "miniapp-last-survivor": {
        const state = await getDoomsdayState(contractHash, network);
        status.jackpot = (BigInt(state.pot as bigint || 0n) / 100000000n).toString();
        status.playersOnline = safeNumber(BigInt(state.totalKeys as bigint || 0n));
        status.nextDraw = Number(state.remainingSeconds || 0);
        return status;
      }
      case "miniapp-dailycheckin": {
        const state = await getDailyCheckinState(contractHash, network);
        status.playersOnline = safeNumber(BigInt(state.totalUsers as bigint || 0n));
        return status;
      }
      case "miniapp-self-loan": {
        const state = await getSelfLoanState(contractHash, network);
        status.tvl = (BigInt(state.totalCollateral as bigint || 0n) / 100000000n).toString();
        status.volume24h = (BigInt(state.totalRepaid as bigint || 0n) / 100000000n).toString();
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
