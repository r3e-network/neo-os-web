/**
 * Contract Query Functions
 * Query flagship MiniApp contract states on Neo N3.
 */

import type { MiniAppInfo } from "@/components/types";
import { invokeRead, type Network, type StackItem } from "./rpc-client";
import { resolveSharedModeRuntime } from "./shared-mode";
import { logger } from "@/lib/logger";

export const CONTRACTS = {
  lastSurvivor: "0xa7840a8d5404bbe297a00756a29cc267d6fa6cc7",
  gasBox: "0xa7840a8d5404bbe297a00756a29cc267d6fa6cc7",
  redEnvelope: "0x5f371cc50116bb13d79554d96ccdd6e246cd5d59",
  dailyCheckin: "0xbd4f3646e189350b9c11a659655854e6f03f9be4",
  fogPlay: "0xa7840a8d5404bbe297a00756a29cc267d6fa6cc7",
  selfLoan: "0x942da575b31f39cbb59e64b5813b128739b44c25",
  neoPay: "0xfd4dcc346d73c4ac6c3db209323561cf7f1b5e34",
  platformAnchor: "0x02beeef6f65c6989a121c0a0e6b23190333edb98",
} as const;

export const TESTNET_CONTRACTS = {
  lastSurvivor: "0x740671b10330ef6669ab8b2724437eb8d5e7a34c",
  gasBox: "0x740671b10330ef6669ab8b2724437eb8d5e7a34c",
  redEnvelope: "0xfa1b7240fead2a63999c02defa3aec5eb274a919",
  dailyCheckin: "0xaba84da240a55410d284a656fc8dae044e6ec1a5",
  fogPlay: "0x740671b10330ef6669ab8b2724437eb8d5e7a34c",
  selfLoan: "0x39d4584ddb0731e48e611647931993ee033bf373",
  neoPay: "0x27a81e6d2f01a1d241b9aef5bed74c93f3a5ca5e",
  platformAnchor: "0xeb6b3725d47d0941f36a834bdbd12f1427977604",
} as const;

const LAST_SURVIVOR_APP_ID = "miniapp-last-survivor";
const FOGPLAY_APP_ID = "miniapp-fogplay";

const PLATFORM_GAME_CONTRACT_HASHES = new Set([
  CONTRACTS.lastSurvivor.toLowerCase(),
  TESTNET_CONTRACTS.lastSurvivor.toLowerCase(),
]);

function isPlatformGameContract(contractHash: string): boolean {
  return PLATFORM_GAME_CONTRACT_HASHES.has(contractHash.toLowerCase());
}

export function getFlagshipApps(network: Network = "mainnet"): Record<string, { contract: string; category: string }> {
  const contracts = network === "testnet" ? TESTNET_CONTRACTS : CONTRACTS;
  const apps: Record<string, { contract: string; category: string }> = {
    "miniapp-last-survivor": { contract: contracts.lastSurvivor, category: "gaming" },
    "miniapp-gasbox": { contract: contracts.gasBox, category: "gaming" },
    "miniapp-redenvelope": { contract: contracts.redEnvelope, category: "social" },
    "miniapp-dailycheckin": { contract: contracts.dailyCheckin, category: "gaming" },
    "miniapp-fogplay": { contract: contracts.fogPlay, category: "gaming" },
    "miniapp-self-loan": { contract: contracts.selfLoan, category: "defi" },
    "miniapp-neo-pay": { contract: contracts.neoPay, category: "defi" },
    "miniapp-trustanchor": { contract: contracts.platformAnchor, category: "defi" },
    "miniapp-profitanchor": { contract: contracts.platformAnchor, category: "defi" },
    "miniapp-trustanchor-admin": { contract: contracts.platformAnchor, category: "utility" },
    "miniapp-profitanchor-admin": { contract: contracts.platformAnchor, category: "utility" },
  };
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
  network: Network = "mainnet",
): Promise<Record<string, unknown>> {
  if (isPlatformGameContract(contractHash) || network === "testnet") {
    const res = await invokeRead(contractHash, "getCountdownStatus", [
      { type: "String", value: LAST_SURVIVOR_APP_ID },
    ], network);
    return mapFromResult(res.stack[0]);
  }
  const res = await invokeRead(contractHash, "getGameStatus", [], network);
  return mapFromResult(res.stack[0]);
}

export async function getDoomsdayPlatformStats(
  contractHash: string = CONTRACTS.lastSurvivor,
  network: Network = "mainnet",
): Promise<Record<string, unknown>> {
  if (isPlatformGameContract(contractHash) || network === "testnet") {
    const state = await getDoomsdayState(contractHash, network);
    return {
      currentRoundPot: parseUnknownInteger(state.pot),
      totalKeysSold: parseUnknownInteger(state.totalKeysSold ?? state.totalKeys),
      totalPlayers: parseUnknownInteger(state.totalPlayers),
    };
  }
  const res = await invokeRead(contractHash, "getPlatformStats", [], network);
  return mapFromResult(res.stack[0]);
}

export async function getDailyCheckinState(
  contractHash: string = CONTRACTS.dailyCheckin,
  network: Network = "mainnet",
): Promise<Record<string, unknown>> {
  const res = await invokeRead(contractHash, "getPlatformStats", [], network);
  return mapFromResult(res.stack[0]);
}

export async function getSelfLoanState(
  contractHash: string = CONTRACTS.selfLoan,
  network: Network = "mainnet",
): Promise<Record<string, unknown>> {
  const res = await invokeRead(contractHash, "getPlatformStats", [], network);
  return mapFromResult(res.stack[0]);
}

export async function getStreamVaultState(
  contractHash: string = CONTRACTS.neoPay,
  network: Network = "mainnet",
): Promise<Record<string, unknown>> {
  const res = await invokeRead(contractHash, "totalStreams", [], network);
  if (!res.stack || res.stack.length === 0) {
    return { totalStreams: 0n };
  }
  return { totalStreams: parseInteger(res.stack[0]) };
}

export async function getCoinFlipState(
  contractHash: string = CONTRACTS.fogPlay,
  network: Network = "mainnet",
): Promise<Record<string, unknown>> {
  if (isPlatformGameContract(contractHash)) {
    const res = await invokeRead(contractHash, "getCoinFlipBetLimits", [
      { type: "String", value: FOGPLAY_APP_ID },
    ], network);
    const values = mapFromResult(res.stack?.[0]);
    return {
      maxBet: parseUnknownInteger(values.maxBet),
      dailyLimit: parseUnknownInteger(values.dailyLimit),
      cooldownSeconds: parseUnknownInteger(values.cooldownMs),
      maxConsecutive: parseUnknownInteger(values.maxConsecutive),
    };
  }

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
  network: Network = "mainnet",
): Promise<Record<string, unknown>> {
  if (isPlatformGameContract(contractHash)) {
    return { totalMachines: 0n };
  }

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
        status.jackpot = (parseUnknownInteger(state.pot) / 100000000n).toString();
        status.playersOnline = safeNumber(parseUnknownInteger(state.totalKeys));
        status.nextDraw = safeNumber(parseUnknownInteger(state.remainingSeconds ?? state.remainingTime));
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
