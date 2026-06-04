/**
 * useGovMercPool -- React hook for Gov Merc domain logic.
 *
 * Equivalent to the Vue composable but uses createObservable instead of ref/computed.
 * All contract interaction is delegated to OS services (PaymentProxy, StorageProxy).
 *
 * Storage model (all keys live in the app's shared StorageProxy namespace, so
 * `list(prefix)` returns entries written by EVERY depositor/bidder — i.e. a true
 * shared aggregate, not a per-wallet view):
 *   - `deposit:{address}`        per-depositor NEO position { address, amount }
 *   - `bid:{epoch}:{address}`    per-epoch GAS bid { address, amount, epoch }
 *   - `epoch-state`              { currentEpoch }
 *   - `settlement:{epoch}`       resolved winner { epoch, winner, amount }
 *
 * Total Pool is the sum of every `deposit:` record (real shared aggregate).
 * The leaderboard is filtered to the live epoch so stale prior-epoch bids never
 * leak in. Epoch settlement resolves the winning bid, records the outcome and
 * advances the epoch so the headline "route each epoch" flow is actually
 * completable.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { PaymentProxy } from "@shared/services/os/PaymentProxy";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import { formatNum } from "@shared/utils/format";

const DEPOSIT_PREFIX = "deposit:";
const BID_PREFIX = "bid:";
const EPOCH_KEY = "epoch-state";

export interface UseGovMercPoolOptions {
  paymentService: PaymentProxy;
  storageService: StorageProxy;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface SettlementResult {
  epoch: number;
  winner: string;
  amount: number;
}

export function useGovMercPool({ paymentService, storageService, t }: UseGovMercPoolOptions) {
  const depositAmount = createObservable("");
  const withdrawAmount = createObservable("");
  const bidAmount = createObservable("");
  const totalPool = createObservable(0);
  const currentEpoch = createObservable(0);
  const userDeposits = createObservable(0);
  const bids = createObservable<{ address: string; amount: number }[]>([]);
  const lastSettlement = createObservable<SettlementResult | null>(null);
  const dataLoading = createObservable(false);
  const address = createObservable("");
  const isProcessing = createObservable(false);

  const isBusy: Observable<boolean> = {
    get: () => isProcessing.get() || dataLoading.get(),
    set: () => {},
    subscribe: (fn) => {
      const u1 = isProcessing.subscribe(fn);
      const u2 = dataLoading.subscribe(fn);
      return () => { u1(); u2(); };
    },
  };

  let isMounted = true;

  const readEntryAmount = (value: unknown): number => {
    if (!value || typeof value !== "object") return 0;
    const entry = value as Record<string, unknown>;
    const amount = Number(entry.amount || 0);
    return Number.isFinite(amount) ? amount : 0;
  };

  /**
   * Total Pool is the real aggregate across ALL depositors: sum every
   * `deposit:{address}` record in the shared namespace. `currentEpoch` is read
   * from the shared epoch-state key. This replaces the old per-wallet
   * `pool-state` counter that only reflected the current wallet's deposits.
   */
  const loadPoolData = async () => {
    try {
      const raw = await storageService.list(DEPOSIT_PREFIX);
      let sum = 0;
      if (raw && typeof raw === "object") {
        for (const value of Object.values(raw)) {
          sum += readEntryAmount(value);
        }
      }
      totalPool.set(Math.max(0, sum));
    } catch (e) {
      console.warn("[useGovMercPool] loadPoolData failed:", e instanceof Error ? e.message : String(e));
    }

    try {
      const epochRaw = await storageService.get(EPOCH_KEY);
      if (epochRaw && typeof epochRaw === "object") {
        const data = epochRaw as Record<string, unknown>;
        currentEpoch.set(Math.max(0, Number(data.currentEpoch || 0)));
      }
    } catch (e) {
      console.warn("[useGovMercPool] loadPoolData (epoch) failed:", e instanceof Error ? e.message : String(e));
    }
  };

  const loadUserDeposits = async () => {
    const addr = address.get();
    if (!addr) {
      userDeposits.set(0);
      return;
    }
    try {
      const raw = await storageService.get(`${DEPOSIT_PREFIX}${addr}`);
      userDeposits.set(Math.max(0, readEntryAmount(raw)));
    } catch (e) {
      console.warn("[useGovMercPool] loadUserDeposits failed:", e instanceof Error ? e.message : String(e));
      userDeposits.set(0);
    }
  };

  /**
   * Leaderboard is the live epoch only: list the `bid:{epoch}:` prefix so stale
   * prior-epoch bids are never mixed into the "Active Bids" signal.
   */
  const loadBids = async () => {
    try {
      const epoch = currentEpoch.get();
      const raw = await storageService.list(`${BID_PREFIX}${epoch}:`);
      if (raw && typeof raw === "object") {
        const map = new Map<string, number>();
        for (const [, value] of Object.entries(raw)) {
          if (!value || typeof value !== "object") continue;
          const entry = value as Record<string, unknown>;
          // Defensive epoch filter: even if a backend ignores the prefix and
          // returns wider results, only keep entries for the live epoch.
          if (entry.epoch !== undefined && Number(entry.epoch) !== epoch) continue;
          const candidate = String(entry.address || "");
          const amount = Number(entry.amount || 0);
          if (!candidate || !Number.isFinite(amount)) continue;
          map.set(candidate, (map.get(candidate) || 0) + amount);
        }
        bids.set(
          Array.from(map.entries())
            .map(([addr, amount]) => ({ address: addr, amount }))
            .sort((a, b) => b.amount - a.amount),
        );
      } else {
        bids.set([]);
      }
    } catch (e) {
      console.warn("[useGovMercPool] loadBids failed:", e instanceof Error ? e.message : String(e));
      bids.set([]);
    }
  };

  const loadSettlement = async () => {
    try {
      const epoch = currentEpoch.get();
      // The most recently settled epoch is the one before the live epoch.
      if (epoch <= 0) {
        lastSettlement.set(null);
        return;
      }
      const raw = await storageService.get(`settlement:${epoch - 1}`);
      if (raw && typeof raw === "object") {
        const data = raw as Record<string, unknown>;
        lastSettlement.set({
          epoch: Number(data.epoch || epoch - 1),
          winner: String(data.winner || ""),
          amount: Number(data.amount || 0),
        });
      } else {
        lastSettlement.set(null);
      }
    } catch (e) {
      console.warn("[useGovMercPool] loadSettlement failed:", e instanceof Error ? e.message : String(e));
      lastSettlement.set(null);
    }
  };

  const loadData = async () => {
    if (!isMounted) return;
    try {
      dataLoading.set(true);
      await loadPoolData();
      if (!isMounted) return;
      await loadUserDeposits();
      if (!isMounted) return;
      await loadBids();
      if (!isMounted) return;
      await loadSettlement();
    } catch (e) {
      console.warn("[useGovMercPool] loadData failed:", e instanceof Error ? e.message : String(e));
    } finally {
      dataLoading.set(false);
    }
  };

  /**
   * Read-modify-write the CURRENT user's `deposit:{address}` record. A positive
   * `delta` deposits, a negative `delta` withdraws (clamped at 0 so a balance
   * never goes negative). Total Pool is recomputed by re-listing every
   * depositor record in loadData, so it stays a true aggregate.
   */
  const applyDeposit = async (delta: number) => {
    const addr = address.get();
    if (!addr) throw new Error(t("walletStatusIdle"));
    const key = `${DEPOSIT_PREFIX}${addr}`;
    const raw = await storageService.get(key);
    const next = Math.max(0, readEntryAmount(raw) + delta);
    if (next <= 0) {
      // Drop the record entirely on full withdrawal so it stops counting
      // toward the shared aggregate.
      await storageService.delete(key);
    } else {
      await storageService.set(key, { address: addr, amount: next });
    }
  };

  const depositNeo = async () => {
    if (isBusy.get()) return;
    const amount = Number(depositAmount.get());
    if (!(amount > 0)) throw new Error(t("enterAmount"));
    try {
      isProcessing.set(true);
      await applyDeposit(amount);
      depositAmount.set("");
      await loadData();
    } finally {
      isProcessing.set(false);
    }
  };

  const withdrawNeo = async () => {
    if (isBusy.get()) return;
    const amount = Number(withdrawAmount.get());
    if (!(amount > 0)) throw new Error(t("enterAmount"));
    // Validate against the user's own deposits so an over-withdrawal gives clear
    // feedback instead of silently clamping the balance (and the pool) to zero.
    if (amount > userDeposits.get()) throw new Error(t("withdrawExceeds"));
    try {
      isProcessing.set(true);
      await applyDeposit(-amount);
      withdrawAmount.set("");
      await loadData();
    } finally {
      isProcessing.set(false);
    }
  };

  const placeBid = async () => {
    if (isBusy.get()) return;
    const amountStr = bidAmount.get();
    const amount = parseFloat(amountStr);
    if (!(amount > 0)) throw new Error(t("enterAmount"));
    const addr = address.get();
    if (!addr) throw new Error(t("walletStatusIdle"));
    try {
      isProcessing.set(true);
      const epoch = currentEpoch.get();
      // Step 1 moves real GAS into the payment vault.
      await paymentService.deposit(amountStr, `govmerc:bid:${epoch}`);
      // Step 2 records the bid. If it fails the GAS is already debited, so
      // compensate by refunding the deposit before re-throwing. Do NOT early-
      // return on unmount here: the GAS has already moved and the record must
      // be written (or rolled back) regardless of mount state.
      try {
        await storageService.set(`${BID_PREFIX}${epoch}:${addr}`, {
          address: addr,
          amount: amountStr,
          epoch,
        });
      } catch (recordErr) {
        try {
          await paymentService.withdraw(amountStr);
        } catch (refundErr) {
          console.warn(
            "[useGovMercPool] placeBid: GAS refund failed after bid record error:",
            refundErr instanceof Error ? refundErr.message : String(refundErr),
          );
          // Refund failed too: the GAS is recoverable manually via the payment
          // balance. Tell the user explicitly so they know funds are safe.
          throw new Error(t("bidRecoverable"));
        }
        // Refund succeeded — surface a distinct, actionable error.
        console.warn(
          "[useGovMercPool] placeBid: bid record failed, GAS refunded:",
          recordErr instanceof Error ? recordErr.message : String(recordErr),
        );
        throw new Error(t("bidRefunded"));
      }
      bidAmount.set("");
      await loadData();
    } finally {
      isProcessing.set(false);
    }
  };

  /**
   * Settle the live epoch: resolve the highest current-epoch bid as the winner,
   * record the outcome under `settlement:{epoch}`, and advance the epoch in
   * `epoch-state`. This implements the headline "route each epoch" flow (flow
   * step 03) that previously had no handler — currentEpoch was read-only and no
   * action resolved a winning bid.
   */
  const settleEpoch = async () => {
    if (isBusy.get()) return;
    const ranked = bids.get();
    const winning = ranked[0];
    if (!winning) throw new Error(t("settleNoBids"));
    const epoch = currentEpoch.get();
    try {
      isProcessing.set(true);
      await storageService.set(`settlement:${epoch}`, {
        epoch,
        winner: winning.address,
        amount: winning.amount,
      });
      const nextEpoch = epoch + 1;
      const epochRaw = await storageService.get(EPOCH_KEY);
      const epochState =
        epochRaw && typeof epochRaw === "object" ? (epochRaw as Record<string, unknown>) : {};
      await storageService.set(EPOCH_KEY, { ...epochState, currentEpoch: nextEpoch });
      currentEpoch.set(nextEpoch);
      await loadData();
    } finally {
      isProcessing.set(false);
    }
  };

  return {
    address,
    depositAmount,
    withdrawAmount,
    bidAmount,
    totalPool,
    currentEpoch,
    userDeposits,
    bids,
    lastSettlement,
    dataLoading,
    isBusy,
    formatNum,
    depositNeo,
    withdrawNeo,
    placeBid,
    settleEpoch,
    loadData,
    setAddress: (addr: string) => { address.set(addr); },
  };
}
