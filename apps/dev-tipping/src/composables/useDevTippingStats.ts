/**
 * Authoritative Dev Tipping reads.
 *
 * Every token amount remains a base-unit integer until the display boundary.
 * Read failures are explicit states; an unavailable RPC is never presented as
 * an empty registry, zero balance, zero credit, or zero lifetime volume.
 */

import { createObservable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import { fromFixed8, formatHash, formatNum } from "@shared/utils/format";
import { eventValue } from "@shared/utils/chain-events";
import { addressToScriptHash, normalizeScriptHash, parseHash160 } from "@shared/utils/neo";

export type DevTippingReadStatus = "idle" | "loading" | "ready" | "partial" | "error";

export interface Developer {
  id: number;
  name: string;
  role: string;
  wallet: string;
  totalTips: number;
  totalTipsBase: string;
  tipCount: number;
  balance: number;
  balanceBase: string;
  rank: string;
}

export interface RecentTip {
  id: string;
  tipperName: string;
  to: string;
  amount: string;
  time: string;
}

export interface WalletSnapshot {
  developerId: number;
  creditBase: bigint;
  gasBalanceBase: bigint;
}

export interface UseDevTippingStatsOptions {
  app: MiniAppFramework;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const MAX_DEVELOPERS = 500;
const RECENT_TIPS_LIMIT = 25;

function asBool(value: unknown): boolean {
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  throw new Error("Invalid boolean chain value");
}

function exactNonNegativeInteger(value: unknown, label: string): bigint {
  let parsed: bigint;
  if (typeof value === "bigint") parsed = value;
  else if (typeof value === "number" && Number.isSafeInteger(value)) parsed = BigInt(value);
  else if (typeof value === "string" && /^\d+$/.test(value.trim())) parsed = BigInt(value.trim());
  else throw new Error(`Invalid ${label} chain value`);
  if (parsed < 0n) throw new Error(`Invalid negative ${label}`);
  return parsed;
}

function safeCount(value: bigint, label: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${label} exceeds safe range`);
  return Number(value);
}

function warning(scope: string, error: unknown): void {
  console.warn(
    `[useDevTippingStats] ${scope} failed:`,
    error instanceof Error ? error.message : String(error),
  );
}

function canonicalAccount(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (/^(?:0x)?[0-9a-fA-F]{40}$/.test(raw)) return normalizeScriptHash(raw);
  const parsed = parseHash160(value);
  if (/^0x[0-9a-f]{40}$/.test(parsed)) return parsed;
  const converted = addressToScriptHash(raw);
  return /^0x[0-9a-f]{40}$/.test(converted) ? converted : "";
}

export function useDevTippingStats({ app, t }: UseDevTippingStatsOptions) {
  const developers = createObservable<Developer[]>([]);
  const recentTips = createObservable<RecentTip[]>([]);
  const totalDonated = createObservable(0);
  const totalDonatedBase = createObservable("0");
  const isLoading = createObservable(false);
  const registryStatus = createObservable<DevTippingReadStatus>("idle");
  const activityStatus = createObservable<DevTippingReadStatus>("idle");
  const readError = createObservable("");
  let registryGeneration = 0;
  let activityGeneration = 0;

  const mapDeveloper = (raw: unknown, id: number): Developer | null => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const value = raw as Record<string, unknown>;
    const wallet = canonicalAccount(value.wallet);
    if (!wallet) return null;

    const name = String(value.name ?? "").trim();
    const role = String(value.role ?? "").trim();
    const totalReceivedBase = exactNonNegativeInteger(value.totalReceived, "developer total");
    const tipCount = safeCount(exactNonNegativeInteger(value.tipCount, "tip count"), "tip count");
    const balanceBase = exactNonNegativeInteger(value.balance, "claimable balance");
    if (
      name.length > 64
      || role.length > 64
      || balanceBase > totalReceivedBase
      || totalReceivedBase < BigInt(tipCount) * 100_000n
    ) return null;

    return {
      id,
      name: name || t("defaultDevName", { id }),
      role: role || t("defaultDevRole"),
      wallet,
      totalTips: fromFixed8(totalReceivedBase),
      totalTipsBase: totalReceivedBase.toString(),
      tipCount,
      balance: fromFixed8(balanceBase),
      balanceBase: balanceBase.toString(),
      rank: "",
    };
  };

  const loadDevelopers = async (): Promise<boolean> => {
    const generation = ++registryGeneration;
    isLoading.set(true);
    registryStatus.set("loading");
    readError.set("");
    try {
      const [totalRaw, donatedRaw] = await Promise.all([
        app.chain.readRaw("totalDevelopers", []),
        app.chain.readRaw("totalDonated", []),
      ]);
      const totalExact = exactNonNegativeInteger(totalRaw, "developer count");
      const donatedExact = exactNonNegativeInteger(donatedRaw, "total donated");
      const total = Math.min(safeCount(totalExact, "developer count"), MAX_DEVELOPERS);
      if (generation !== registryGeneration) return false;

      if (total === 0) {
        developers.set([]);
        totalDonatedBase.set(donatedExact.toString());
        totalDonated.set(fromFixed8(donatedExact));
        registryStatus.set("ready");
        return true;
      }

      const ids = Array.from({ length: total }, (_, index) => index + 1);
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const raw = await app.chain.readRaw("getDeveloper", [app.chain.arg.integer(id)]);
            return { developer: mapDeveloper(raw, id), failed: false };
          } catch (error) {
            warning(`getDeveloper(${id})`, error);
            return { developer: null, failed: true };
          }
        }),
      );
      const validDevelopers = results
        .map((result) => result.developer)
        .filter((developer): developer is Developer => developer !== null)
        .sort((left, right) => {
          const byTotal = BigInt(right.totalTipsBase) - BigInt(left.totalTipsBase);
          if (byTotal > 0n) return 1;
          if (byTotal < 0n) return -1;
          return left.id - right.id;
        });
      if (generation !== registryGeneration) return false;
      if (validDevelopers.length === 0) {
        throw new Error("Developer registry could not be read");
      }
      validDevelopers.forEach((developer, index) => {
        developer.rank = `#${index + 1}`;
      });
      developers.set(validDevelopers);
      totalDonatedBase.set(donatedExact.toString());
      totalDonated.set(fromFixed8(donatedExact));
      const partial = totalExact > BigInt(MAX_DEVELOPERS) || results.some((result) => result.failed);
      registryStatus.set(partial ? "partial" : "ready");
      return true;
    } catch (error) {
      warning("loadDevelopers", error);
      if (generation === registryGeneration) {
        readError.set(t("registryUnavailable"));
        registryStatus.set("error");
      }
      throw error;
    } finally {
      if (generation === registryGeneration) isLoading.set(false);
    }
  };

  const loadRecentTips = async (): Promise<boolean> => {
    const generation = ++activityGeneration;
    activityStatus.set("loading");
    try {
      const events = await app.chain.events("Tipped", { limit: RECENT_TIPS_LIMIT });
      const developerNames = new Map(developers.get().map((developer) => [developer.id, developer.name]));
      let malformed = false;
      const tips = events.flatMap((event) => {
        try {
          const tipId = exactNonNegativeInteger(eventValue(event, 0), "tip id");
          if (tipId <= 0n) throw new Error("Invalid tip id");
          const developerId = safeCount(
            exactNonNegativeInteger(eventValue(event, 1), "developer id"),
            "developer id",
          );
          if (developerId <= 0) throw new Error("Invalid developer id");
          const tipper = String(eventValue(event, 2) ?? "").trim();
          const amountBase = exactNonNegativeInteger(eventValue(event, 3), "tip amount");
          const anonymous = asBool(eventValue(event, 4));
          return [{
            id: tipId.toString(),
            tipperName: anonymous || !tipper ? "" : formatHash(tipper),
            to: developerNames.get(developerId) || t("defaultDevName", { id: developerId }),
            amount: app.amount.fixed8ToGas(amountBase, 8),
            time: "",
          } satisfies RecentTip];
        } catch (error) {
          malformed = true;
          warning("parse Tipped event", error);
          return [];
        }
      });
      if (generation !== activityGeneration) return false;
      recentTips.set(tips);
      activityStatus.set(malformed ? "partial" : "ready");
      return true;
    } catch (error) {
      warning("loadRecentTips", error);
      if (generation === activityGeneration) activityStatus.set("error");
      return false;
    }
  };

  const developerIdOf = async (address: string): Promise<number> => {
    if (!address) throw new Error(t("walletNotConnected"));
    const raw = await app.chain.readRaw("developerIdOf", [app.chain.arg.hash160(address)]);
    return safeCount(exactNonNegativeInteger(raw, "developer id"), "developer id");
  };

  const creditOf = async (address: string): Promise<bigint> => {
    if (!address) throw new Error(t("walletNotConnected"));
    const raw = await app.chain.readRaw("creditOf", [app.chain.arg.hash160(address)]);
    return exactNonNegativeInteger(raw, "tip credit");
  };

  const gasBalanceOf = async (address: string): Promise<bigint> => {
    if (!address) throw new Error(t("walletNotConnected"));
    const raw = await app.chain.readRaw(
      "balanceOf",
      [app.chain.arg.hash160(address)],
      { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
    );
    return exactNonNegativeInteger(raw, "wallet GAS balance");
  };

  const loadWalletSnapshot = async (address: string): Promise<WalletSnapshot> => {
    const [developerId, creditBase, gasBalanceBase] = await Promise.all([
      developerIdOf(address),
      creditOf(address),
      gasBalanceOf(address),
    ]);
    return { developerId, creditBase, gasBalanceBase };
  };

  return {
    developers,
    recentTips,
    totalDonated,
    totalDonatedBase,
    isLoading,
    registryStatus,
    activityStatus,
    readError,
    formatNum,
    loadDevelopers,
    loadRecentTips,
    developerIdOf,
    creditOf,
    gasBalanceOf,
    loadWalletSnapshot,
  };
}
