/**
 * Contract Query Functions
 * Query flagship MiniApp contract states on Neo N3.
 */

import { invokeRead, type Network, type StackItem } from "./rpc-client";
import { logger } from "@/lib/logger";

export const CONTRACTS = {
  doomsdayClock: "0xf0914d411877c8393c029f48ec0c4c64d44f1b49",
  neoGacha: "0x523c112560a2e196fa0fcfa215d93c08e117d9c1",
  redEnvelope: "0x4079c09a0ff121fc44d817c37d6ae8694b268e9f",
  dailyCheckin: "0xdd01243419941e8cdc8eb194a9d1fc7fcbafd528",
  coinFlip: "0x43f953c00931ca38044bf0e5ca50d608aea7ae8b",
  selfLoan: "0x2a19ae9c53a5373d064adaff5c6be1c545f00e2b",
  streamVault: "0x89d2499928e3035247186f412934d6b0e0b665ef",
} as const;

export const FLAGSHIP_APPS: Record<string, { contract: string; category: string }> = {
  "miniapp-doomsday-clock": { contract: CONTRACTS.doomsdayClock, category: "gaming" },
  "miniapp-neo-gacha": { contract: CONTRACTS.neoGacha, category: "gaming" },
  "miniapp-redenvelope": { contract: CONTRACTS.redEnvelope, category: "social" },
  "miniapp-dailycheckin": { contract: CONTRACTS.dailyCheckin, category: "gaming" },
  "miniapp-coinflip": { contract: CONTRACTS.coinFlip, category: "gaming" },
  "miniapp-self-loan": { contract: CONTRACTS.selfLoan, category: "defi" },
  "miniapp-stream-vault": { contract: CONTRACTS.streamVault, category: "defi" },
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

export async function getDoomsdayState(
  contractHash: string = CONTRACTS.doomsdayClock,
  network: Network = "testnet",
): Promise<Record<string, unknown>> {
  const res = await invokeRead(contractHash, "getGameStatus", [], network);
  return mapFromResult(res.stack[0]);
}

export async function getDoomsdayPlatformStats(
  contractHash: string = CONTRACTS.doomsdayClock,
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
  contractHash: string = CONTRACTS.streamVault,
  network: Network = "testnet",
): Promise<Record<string, unknown>> {
  const res = await invokeRead(contractHash, "totalStreams", [], network);
  return { totalStreams: parseInteger(res.stack[0]) };
}

export async function getCoinFlipState(
  contractHash: string = CONTRACTS.coinFlip,
  network: Network = "testnet",
): Promise<Record<string, unknown>> {
  const res = await invokeRead(contractHash, "getBetLimits", [], network);
  const values = Array.isArray(res.stack?.[0]?.value) ? (res.stack[0].value as StackItem[]) : [];
  return {
    maxBet: parseInteger(values[0]),
    dailyLimit: parseInteger(values[1]),
    cooldownSeconds: parseInteger(values[2]),
    maxConsecutive: parseInteger(values[3]),
  };
}

export async function getNeoGachaState(
  contractHash: string = CONTRACTS.neoGacha,
  network: Network = "testnet",
): Promise<Record<string, unknown>> {
  const res = await invokeRead(contractHash, "totalMachines", [], network);
  return { totalMachines: parseInteger(res.stack[0]) };
}

export async function getContractStats(
  contractHash: string,
  network: Network = "testnet",
  appId?: string,
): Promise<MiniAppContractStats> {
  try {
    switch (appId) {
      case "miniapp-doomsday-clock": {
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
      case "miniapp-stream-vault": {
        const state = await getStreamVaultState(contractHash, network);
        return {
          totalValueLocked: "0",
          totalTransactions: safeNumber(BigInt(state.totalStreams as bigint || 0n)),
          uniqueUsers: 0,
        };
      }
      case "miniapp-coinflip":
      case "miniapp-neo-gacha":
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
      case "miniapp-doomsday-clock": {
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
      case "miniapp-stream-vault": {
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
