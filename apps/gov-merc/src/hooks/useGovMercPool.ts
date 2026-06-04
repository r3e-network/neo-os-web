/**
 * useGovMercPool -- React hook for Gov Merc domain logic.
 *
 * Equivalent to the Vue composable but uses createObservable instead of ref/computed.
 * All contract interaction is delegated to OS services (PaymentProxy, StorageProxy).
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { PaymentProxy } from "@shared/services/os/PaymentProxy";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import { formatNum } from "@shared/utils/format";

export interface UseGovMercPoolOptions {
  paymentService: PaymentProxy;
  storageService: StorageProxy;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useGovMercPool({ paymentService, storageService, t }: UseGovMercPoolOptions) {
  const depositAmount = createObservable("");
  const withdrawAmount = createObservable("");
  const bidAmount = createObservable("");
  const totalPool = createObservable(0);
  const currentEpoch = createObservable(0);
  const userDeposits = createObservable(0);
  const bids = createObservable<{ address: string; amount: number }[]>([]);
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

  const loadPoolData = async () => {
    try {
      const raw = await storageService.get("pool-state");
      if (raw && typeof raw === "object") {
        const data = raw as Record<string, unknown>;
        totalPool.set(Number(data.totalPool || 0));
        currentEpoch.set(Number(data.currentEpoch || 0));
      }
    } catch (e) {
      console.warn("[useGovMercPool] loadPoolData failed:", e instanceof Error ? e.message : String(e));
    }
  };

  const loadUserDeposits = async () => {
    if (!address.get()) return;
    try {
      const raw = await storageService.get("user-deposits");
      userDeposits.set(Number(raw || 0));
    } catch (e) {
      console.warn("[useGovMercPool] loadUserDeposits failed:", e instanceof Error ? e.message : String(e));
      userDeposits.set(0);
    }
  };

  const loadBids = async () => {
    try {
      const raw = await storageService.list("bid:");
      if (raw && typeof raw === "object") {
        const map = new Map<string, number>();
        for (const [, value] of Object.entries(raw)) {
          if (!value || typeof value !== "object") continue;
          const entry = value as Record<string, unknown>;
          const candidate = String(entry.address || "");
          const amount = Number(entry.amount || 0);
          if (!candidate) continue;
          map.set(candidate, (map.get(candidate) || 0) + amount);
        }
        bids.set(
          Array.from(map.entries())
            .map(([addr, amount]) => ({ address: addr, amount }))
            .sort((a, b) => b.amount - a.amount),
        );
      }
    } catch (e) {
      console.warn("[useGovMercPool] loadBids failed:", e instanceof Error ? e.message : String(e));
      bids.set([]);
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
    } catch (e) {
      console.warn("[useGovMercPool] loadData failed:", e instanceof Error ? e.message : String(e));
    } finally {
      dataLoading.set(false);
    }
  };

  /**
   * Read-modify-write the aggregate records the loaders consume so a successful
   * deposit/withdraw is reflected in Total Pool and Your Deposits. A positive
   * `delta` deposits, a negative `delta` withdraws (clamped at 0 so balances
   * never go negative). Writes the very keys loadPoolData/loadUserDeposits read
   * ("pool-state", "user-deposits") — keeping the write/read namespace aligned.
   */
  const applyDeposit = async (delta: number) => {
    const poolRaw = await storageService.get("pool-state");
    const pool = poolRaw && typeof poolRaw === "object" ? (poolRaw as Record<string, unknown>) : {};
    const nextTotal = Math.max(0, Number(pool.totalPool || 0) + delta);
    await storageService.set("pool-state", {
      ...pool,
      totalPool: nextTotal,
      currentEpoch: Number(pool.currentEpoch || 0),
    });

    const userRaw = await storageService.get("user-deposits");
    const nextUser = Math.max(0, Number(userRaw || 0) + delta);
    await storageService.set("user-deposits", nextUser);
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
    try {
      isProcessing.set(true);
      // Step 1 moves real GAS into the payment vault.
      await paymentService.deposit(amountStr, `govmerc:bid:${currentEpoch.get()}`);
      // Step 2 records the bid. If it fails the GAS is already debited, so
      // compensate by refunding the deposit before re-throwing. Do NOT early-
      // return on unmount here: the GAS has already moved and the record must
      // be written (or rolled back) regardless of mount state.
      try {
        await storageService.set(`bid:${currentEpoch.get()}:${address.get()}`, {
          address: address.get(),
          amount: amountStr,
          epoch: currentEpoch.get(),
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

  return {
    address,
    depositAmount,
    withdrawAmount,
    bidAmount,
    totalPool,
    currentEpoch,
    userDeposits,
    bids,
    dataLoading,
    isBusy,
    formatNum,
    depositNeo,
    withdrawNeo,
    placeBid,
    loadData,
    setAddress: (addr: string) => { address.set(addr); },
  };
}
