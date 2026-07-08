/**
 * useDevTippingStats — Developer registry + tip history loaded straight from the
 * standalone on-chain contract (MiniAppTipJar) via the framework chain layer.
 *
 * The earlier path read a developer registry and a tips:recent list from OS
 * StorageProxy that no contract ever wrote, and routed tips through the OS
 * PaymentProxy edge function (which moved nothing once the kernel degraded). This
 * composable now reads the authoritative on-chain state directly:
 *
 *   READS (chain.read, default app contract script hash):
 *     totalDevelopers()        -> Integer (developers are devIds 1..N)
 *     getDeveloper(devId)      -> Map{id,wallet,name,role,totalReceived,tipCount,balance}
 *                                 (all GAS amounts in BASE UNITS)
 *     totalDonated()           -> Integer (lifetime tipped, BASE UNITS)
 *     developerIdOf(wallet)    -> Integer (0 if the wallet is unregistered)
 *
 *   EVENTS (chain.listEvents):
 *     Tipped(tipId, devId, tipper, amount, anonymous) — the lag-free recent-tip
 *       history source. state slots: [0]=tipId, [1]=devId, [2]=tipper(address),
 *       [3]=amount(base units), [4]=anonymous(bool).
 *
 * AMOUNT CONVENTION: the contract returns BASE UNITS (GAS × 1e8). Human GAS for
 * the UI = base / 1e8 (fromFixed8). Nothing here writes the chain; tip/register/
 * withdraw mutations live in useDevTippingWallet.
 */

import { createObservable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import { fromFixed8, formatHash, formatNum } from "@shared/utils/format";
import { eventValue } from "@shared/utils/chain-events";
import { parseBigInt } from "@shared/utils/parsers";

export interface Developer {
  id: number;
  name: string;
  role: string;
  wallet: string;
  totalTips: number;
  tipCount: number;
  balance: number;
  rank: string;
}

export interface RecentTip {
  id: string;
  tipperName: string;
  to: string;
  amount: string;
  time: string;
}

export interface UseDevTippingStatsOptions {
  /** MiniApp framework SDK from ctx.framework. */
  app: MiniAppFramework;
  t: (key: string, params?: Record<string, string | number>) => string;
}

/** Hard cap on how many developers to enumerate per refresh (defensive). */
const MAX_DEVELOPERS = 500;

/** How many recent Tipped events to page in for the activity feed. */
const RECENT_TIPS_LIMIT = 25;

/** Coerce a NeoVM boolean (true / "true" / 1 / "1") to a JS boolean. */
function asBool(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

/** Coerce an unknown to a finite number, defaulting to 0. */
function toFinite(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function useDevTippingStats({ app, t }: UseDevTippingStatsOptions) {
  const developers = createObservable<Developer[]>([]);
  const recentTips = createObservable<RecentTip[]>([]);
  const totalDonated = createObservable(0);
  const isLoading = createObservable(false);

  /**
   * Map a getDeveloper Map (returned by chain.read as a plain object) into the
   * Developer shape used by the UI. Returns null for a missing / zeroed dev.
   * GAS amounts are BASE UNITS → human GAS via fromFixed8.
   */
  const mapDeveloper = (raw: unknown, id: number): Developer | null => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const v = raw as Record<string, unknown>;
    const wallet = String(v.wallet ?? "").trim();
    if (!wallet) return null;

    const name = String(v.name ?? "").trim();
    const role = String(v.role ?? "").trim();
    const totalReceived = fromFixed8(parseBigInt(v.totalReceived));
    const tipCount = toFinite(v.tipCount);
    const balance = fromFixed8(parseBigInt(v.balance));

    return {
      id,
      name: name || t("defaultDevName", { id }),
      role: role || t("defaultDevRole"),
      wallet,
      totalTips: totalReceived,
      tipCount,
      balance,
      rank: "",
    };
  };

  /**
   * Load the developer registry from totalDevelopers() + getDeveloper(id) for
   * id 1..N. Sorted by lifetime tips (desc) with rank assigned. totalDonated is
   * read from the contract's running total.
   */
  const loadDevelopers = async () => {
    isLoading.set(true);
    try {
      const totalRaw = await app.chain.readRaw("totalDevelopers", []);
      const total = Math.min(toFinite(totalRaw), MAX_DEVELOPERS);

      if (total <= 0) {
        developers.set([]);
        totalDonated.set(0);
        return;
      }

      const ids: number[] = [];
      for (let id = 1; id <= total; id += 1) ids.push(id);

      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const raw = await app.chain.readRaw("getDeveloper", [
              { type: "Integer", value: String(id) },
            ]);
            return mapDeveloper(raw, id);
          } catch (e) {
            console.warn(
              "[useDevTippingStats] getDeveloper failed for",
              id,
              ":",
              e instanceof Error ? e.message : String(e),
            );
            return null;
          }
        }),
      );

      const validDevs = results.filter((d): d is Developer => d !== null);
      validDevs.sort((a, b) => b.totalTips - a.totalTips);
      validDevs.forEach((dev, idx) => {
        dev.rank = `#${idx + 1}`;
      });
      developers.set(validDevs);

      try {
        totalDonated.set(fromFixed8(parseBigInt(await app.chain.readRaw("totalDonated", []))));
      } catch (e) {
        console.warn(
          "[useDevTippingStats] totalDonated read failed:",
          e instanceof Error ? e.message : String(e),
        );
      }
    } catch (e) {
      console.warn(
        "[useDevTippingStats] loadDevelopers failed:",
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      isLoading.set(false);
    }
  };

  /**
   * Load the recent-tip activity feed from Tipped events. The contract stores
   * only the tipper address + anonymous flag (no name/message), so each tip
   * shows the developer it went to and either a truncated tipper address or an
   * "Anonymous" label (anonymous tips suppress the tipper). Must run after
   * loadDevelopers so devId → name resolution is populated.
   */
  const loadRecentTips = async () => {
    try {
      const events = await app.chain.events("Tipped", { limit: RECENT_TIPS_LIMIT });
      const devMap = new Map(developers.get().map((dev) => [dev.id, dev.name]));

      const tips = events
        .map((event, idx) => {
          const tipId = parseBigInt(eventValue(event, 0));
          const devId = Number(parseBigInt(eventValue(event, 1)));
          const tipper = String(eventValue(event, 2) ?? "").trim();
          const amount = fromFixed8(parseBigInt(eventValue(event, 3)));
          const anonymous = asBool(eventValue(event, 4));

          if (devId <= 0) return null;

          const to = devMap.get(devId) || t("defaultDevName", { id: devId });
          // The contract has no tipper-name field; show a truncated address for
          // non-anonymous tips (empty for anonymous → UI renders "Anonymous").
          const tipperName = anonymous || !tipper ? "" : formatHash(tipper);

          return {
            id: tipId > 0n ? tipId.toString() : `tip-${idx}`,
            tipperName,
            to,
            amount: amount.toFixed(2),
            // The Tipped event carries no timestamp; the feed is ordered newest
            // first by the event index from listEvents.
            time: "",
          } satisfies RecentTip;
        })
        .filter((tip): tip is RecentTip => tip !== null);

      recentTips.set(tips);
    } catch (e) {
      console.warn(
        "[useDevTippingStats] loadRecentTips failed:",
        e instanceof Error ? e.message : String(e),
      );
      recentTips.set([]);
    }
  };

  /**
   * Resolve the devId owned by a wallet (0 if unregistered). Used by the UI to
   * decide whether to show the register form vs. the withdraw action.
   */
  const developerIdOf = async (address: string): Promise<number> => {
    if (!address) return 0;
    try {
      return Number(parseBigInt(await app.chain.readRaw("developerIdOf", [app.chain.arg.hash160(address)])));
    } catch (e) {
      console.warn(
        "[useDevTippingStats] developerIdOf failed:",
        e instanceof Error ? e.message : String(e),
      );
      return 0;
    }
  };

  /**
   * Read the connected wallet's stranded tip credit (deposited GAS not yet
   * applied to a tip) in human GAS — drives the reclaim affordance. The contract
   * exposes creditOf(account) in base units.
   */
  const creditOf = async (address: string): Promise<number> => {
    if (!address) return 0;
    try {
      return fromFixed8(parseBigInt(await app.chain.readRaw("creditOf", [app.chain.arg.hash160(address)])));
    } catch (e) {
      console.warn(
        "[useDevTippingStats] creditOf failed:",
        e instanceof Error ? e.message : String(e),
      );
      return 0;
    }
  };

  return {
    developers,
    recentTips,
    totalDonated,
    isLoading,
    formatNum,
    loadDevelopers,
    loadRecentTips,
    developerIdOf,
    creditOf,
  };
}
