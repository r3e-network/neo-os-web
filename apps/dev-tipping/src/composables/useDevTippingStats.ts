/**
 * Authoritative Dev Tipping reads.
 *
 * Every token amount remains a base-unit integer until the display boundary.
 * Read failures are explicit states; an unavailable RPC is never presented as
 * an empty registry, zero balance, zero credit, or zero lifetime volume.
 */

import { createDerived, createObservable, createReadCell } from "@shared/react/context";
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

// Stable empty rows so deriveds hand back the same identity on every read
// while their cell is still unread (mirrors the timestamp-proof NO_PROOFS pin).
const NO_DEVELOPERS: Developer[] = [];
const NO_RECENT_TIPS: RecentTip[] = [];

/**
 * One settled registry read. "partial" is a property of WHAT was read (some
 * rows were unreadable or truncated), not of whether we asked — so it travels
 * inside the snapshot and the legacy five-state status union is derived from
 * cell status + snapshot instead of being hand-published.
 */
interface RegistrySnapshot {
  rows: Developer[];
  totalDonatedBase: string;
  partial: boolean;
}

/** One settled activity read: parsed tips plus whether any event was malformed. */
interface ActivitySnapshot {
  rows: RecentTip[];
  partial: boolean;
}

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
  const isLoading = createObservable(false);
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

  /**
   * A newer registry load() has already bumped the cell epoch when this is
   * called, so nothing the superseded pass returns can publish — the value
   * below only satisfies the loader contract and is never observable.
   * Returning early here preserves the old mid-read abort: a superseded pass
   * must not fire the per-developer read fan-out.
   */
  const supersededRegistryRead = (): RegistrySnapshot =>
    registryCell.value.get() ?? { rows: NO_DEVELOPERS, totalDonatedBase: "0", partial: false };

  /**
   * Registry read lane on the platform read-cell (read-cell pilot). The cell
   * owns what the hand-rolled registryStatus/registryGeneration plumbing
   * carried: value === undefined is the old "idle", the epoch is
   * last-write-wins over overlapping loads, and a failed re-read keeps the
   * last good rows renderable. `registryGeneration` remains ONLY as the
   * fan-out short-circuit (every loader run is one load(), so "generation
   * moved" and "epoch moved" stay in lockstep) and as the isLoading guard.
   */
  const registryCell = createReadCell<RegistrySnapshot>(async (): Promise<RegistrySnapshot> => {
    const generation = ++registryGeneration;
    isLoading.set(true);
    try {
      const [totalRaw, donatedRaw] = await Promise.all([
        app.chain.readRaw("totalDevelopers", []),
        app.chain.readRaw("totalDonated", []),
      ]);
      const totalExact = exactNonNegativeInteger(totalRaw, "developer count");
      const donatedExact = exactNonNegativeInteger(donatedRaw, "total donated");
      const total = Math.min(safeCount(totalExact, "developer count"), MAX_DEVELOPERS);
      if (generation !== registryGeneration) return supersededRegistryRead();

      if (total === 0) {
        return { rows: NO_DEVELOPERS, totalDonatedBase: donatedExact.toString(), partial: false };
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
      if (generation !== registryGeneration) return supersededRegistryRead();
      if (validDevelopers.length === 0) {
        throw new Error("Developer registry could not be read");
      }
      validDevelopers.forEach((developer, index) => {
        developer.rank = `#${index + 1}`;
      });
      const partial = totalExact > BigInt(MAX_DEVELOPERS) || results.some((result) => result.failed);
      return { rows: validDevelopers, totalDonatedBase: donatedExact.toString(), partial };
    } catch (error) {
      warning("loadDevelopers", error);
      throw error;
    } finally {
      if (generation === registryGeneration) isLoading.set(false);
    }
  });

  const developers = createDerived<Developer[]>(
    () => registryCell.value.get()?.rows ?? NO_DEVELOPERS,
    [registryCell.value],
  );
  const totalDonatedBase = createDerived(
    () => registryCell.value.get()?.totalDonatedBase ?? "0",
    [registryCell.value],
  );
  const totalDonated = createDerived(
    () => fromFixed8(registryCell.value.get()?.totalDonatedBase ?? "0"),
    [registryCell.value],
  );
  // Legacy five-state union, derived: the cell speaks idle|loading|ready|error
  // verbatim, and "ready with unreadable rows" renders as the old "partial".
  const registryStatus = createDerived<DevTippingReadStatus>(
    () => {
      const status = registryCell.status.get();
      if (status === "ready" && registryCell.value.get()?.partial) return "partial";
      return status;
    },
    [registryCell.status, registryCell.value],
  );
  const readError = createDerived(
    () => (registryCell.status.get() === "error" ? t("registryUnavailable") : ""),
    [registryCell.status],
  );

  /**
   * Activity read lane on the platform read-cell. No superseded short-circuit
   * is needed here: the mapping after the single events read is synchronous,
   * and the epoch already suppresses a superseded pass's publish.
   */
  const activityCell = createReadCell<ActivitySnapshot>(async (): Promise<ActivitySnapshot> => {
    ++activityGeneration;
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
    return { rows: tips, partial: malformed };
  });

  const recentTips = createDerived<RecentTip[]>(
    () => activityCell.value.get()?.rows ?? NO_RECENT_TIPS,
    [activityCell.value],
  );
  const activityStatus = createDerived<DevTippingReadStatus>(
    () => {
      const status = activityCell.status.get();
      if (status === "ready" && activityCell.value.get()?.partial) return "partial";
      return status;
    },
    [activityCell.status, activityCell.value],
  );

  const loadDevelopers = async (): Promise<boolean> => {
    const read = registryCell.load();
    // The loader has already run its synchronous prologue, so this reads THIS
    // call's generation — the same value the old function-scoped copy held.
    const generation = registryGeneration;
    await read;
    return generation === registryGeneration;
  };

  const loadRecentTips = async (): Promise<boolean> => {
    const read = activityCell.load();
    const generation = activityGeneration;
    try {
      await read;
    } catch (error) {
      warning("loadRecentTips", error);
      return false;
    }
    return generation === activityGeneration;
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
