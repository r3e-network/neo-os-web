import { createDerived, createObservable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import type { MiniAppLaunchNetwork } from "@shared/utils/launch-params";
import {
  GAS_SPONSOR_DESCRIPTION_MAX_LENGTH,
  GAS_SPONSOR_MAX_CLAIM_RAW,
  GAS_SPONSOR_MIN_CREATE_RAW,
  GAS_SPONSOR_MIN_TOP_UP_RAW,
  GAS_SPONSOR_PAYMENT_MEMO,
  GAS_SPONSOR_POOL_TYPE_PUBLIC,
  findGasSponsorNotification,
  gasSponsorAccountsMatch,
  gasSponsorNotificationValue,
  gasSponsorReadContext,
  gasSponsorSafeInteger,
  gasSponsorUnsigned,
  isPendingGasSponsorOperation,
  mapWithConcurrency,
  normalizeGasSponsorAccount,
  normalizeGasSponsorTxid,
  parseGasSponsorPlatformStats,
  parseGasSponsorPool,
  readGasSponsorTransactionOutcome,
  requireWritableGasSponsorContext,
  type GasSponsorChainContext,
  type GasSponsorNotification,
  type GasSponsorOperationKind,
  type GasSponsorOutcome,
  type GasSponsorPlatformStats,
  type GasSponsorPool,
  type GasSponsorTransactionOutcome,
  type PendingGasSponsorOperation,
} from "../gas-sponsor-chain";

export type {
  GasSponsorOutcome,
  GasSponsorPlatformStats,
  GasSponsorPool,
  PendingGasSponsorOperation,
} from "../gas-sponsor-chain";

const PAGE_SIZE = 8;
const POOL_READ_CONCURRENCY = 4;
const PENDING_STORAGE_KEY = "gas-sponsor/pending-operation-v2";
const STORAGE_PROBE_KEY = "gas-sponsor/pending-storage-probe-v2";
const EVENT_WAIT_MS = 45_000;

type GasSponsorMode = "browse" | "create" | "manage";

export interface UseGasSponsorAppOptions {
  app: MiniAppFramework;
  t: (key: string, params?: Record<string, string | number>) => string;
  network?: MiniAppLaunchNetwork | null;
  /** Test/integration seam; production uses the canonical RPC application log reader. */
  transactionOutcomeReader?: typeof readGasSponsorTransactionOutcome;
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function positiveId(value: unknown): string {
  const raw = clean(value);
  return /^[1-9]\d*$/.test(raw) ? BigInt(raw).toString() : "";
}

function eventFromImmediate(
  app: MiniAppFramework,
  contract: string,
  eventName: string,
  event: unknown,
): GasSponsorNotification | null {
  if (!event) return null;
  const state = [0, 1, 2, 3, 4].map((index) => app.chain.eventValue(event, index));
  if (state.every((item) => item === undefined)) return null;
  return { contract, eventName, state };
}

function withMine(pool: GasSponsorPool, walletHash: string): GasSponsorPool {
  return { ...pool, isMine: Boolean(walletHash) && gasSponsorAccountsMatch(pool.sponsor, walletHash) };
}

function minRaw(...values: bigint[]): bigint {
  return values.reduce((lowest, value) => value < lowest ? value : lowest);
}

export function useGasSponsorApp({
  app,
  t,
  network: requestedNetwork,
  transactionOutcomeReader = readGasSponsorTransactionOutcome,
}: UseGasSponsorAppOptions) {
  const initialContext = gasSponsorReadContext(app, requestedNetwork);
  const mode = createObservable<GasSponsorMode>("browse");
  const network = createObservable(initialContext.network);
  const contractHash = createObservable(initialContext.contractHash);
  const platformStats = createObservable<GasSponsorPlatformStats | null>(null);
  const pools = createObservable<GasSponsorPool[]>([]);
  const poolsLoading = createObservable(false);
  const poolsError = createObservable("");
  const hasMorePools = createObservable(false);
  const nextPoolCursor = createObservable(0);

  const selectedPoolId = createObservable("");
  const selectedPool = createObservable<GasSponsorPool | null>(null);
  const selectedPoolLoading = createObservable(false);
  const selectedPoolError = createObservable("");

  const walletAddress = createObservable(clean(app.chain.address.get()));
  const walletHash = createObservable(normalizeGasSponsorAccount(app.chain.address.get()));
  const walletContextReady = createObservable(false);
  const walletGasBalanceFixed8 = createObservable("");
  const walletGasBalanceKnown = createObservable(false);
  const userClaimedFixed8 = createObservable("");
  const userClaimedKnown = createObservable(false);

  const storedPending = app.storage.local.get<unknown>(PENDING_STORAGE_KEY, null);
  const pendingOperation = createObservable<PendingGasSponsorOperation | null>(
    isPendingGasSponsorOperation(storedPending) ? storedPending : null,
  );
  if (storedPending && !isPendingGasSponsorOperation(storedPending)) {
    app.storage.local.delete(PENDING_STORAGE_KEY);
  }
  const outcome = createObservable<GasSponsorOutcome>(pendingOperation.get()
    ? {
        status: "pending",
        operation: pendingOperation.get()!.kind,
        message: t("sponsorOperationPending"),
        txid: pendingOperation.get()!.txid,
        paymentTxid: pendingOperation.get()!.paymentTxid,
        poolId: pendingOperation.get()!.poolId,
        amountRaw: pendingOperation.get()!.amountRaw,
      }
    : { status: "idle", operation: null, message: "" });
  const actionBusy = createObservable(false);

  const claimAmount = createObservable("0.01");
  const createAmount = createObservable("1");
  const createMaxClaim = createObservable("0.05");
  const createDescription = createObservable(t("defaultPoolDescription"));
  const topUpAmount = createObservable("0.5");
  const extendDurationMs = createObservable("2592000");
  const withdrawAmount = createObservable("");

  let platformGeneration = 0;
  let selectedGeneration = 0;
  let walletGeneration = 0;

  const parseGas = (value: string): bigint | null => {
    const raw = app.amount.parseGasToFixed8(value);
    if (!raw || !/^\d+$/.test(raw)) return null;
    const parsed = BigInt(raw);
    return parsed > 0n ? parsed : null;
  };

  const selectedPoolIsMine = createDerived(
    () => Boolean(selectedPool.get()?.isMine),
    [selectedPool],
  );
  const selectedPoolExpired = createDerived(
    () => {
      const pool = selectedPool.get();
      return Boolean(pool && pool.expiryTimeMs <= Date.now());
    },
    [selectedPool],
  );
  const selectedPoolRemainingFixed8 = createDerived(
    () => selectedPool.get()?.remainingAmountRaw ?? "",
    [selectedPool],
  );
  const selectedPoolClaimAvailableRaw = createDerived(() => {
    const pool = selectedPool.get();
    if (!pool || !userClaimedKnown.get()) return "";
    const maximum = BigInt(pool.maxClaimPerUserRaw);
    const alreadyClaimed = BigInt(userClaimedFixed8.get());
    const remainingForUser = maximum > alreadyClaimed ? maximum - alreadyClaimed : 0n;
    return minRaw(remainingForUser, BigInt(pool.remainingAmountRaw)).toString();
  }, [selectedPool, userClaimedFixed8, userClaimedKnown]);
  const canResumePending = createDerived(() => {
    const pending = pendingOperation.get();
    return Boolean(
      pending
      && pending.phase === "payment-confirmed"
      && (pending.kind === "create" || pending.kind === "topUp")
      && !actionBusy.get(),
    );
  }, [pendingOperation, actionBusy]);

  const canClaim = createDerived(() => {
    const pool = selectedPool.get();
    const amount = parseGas(claimAmount.get());
    const available = selectedPoolClaimAvailableRaw.get();
    return Boolean(
      pool
      && walletContextReady.get()
      && !pendingOperation.get()
      && !actionBusy.get()
      && userClaimedKnown.get()
      && pool.poolType === GAS_SPONSOR_POOL_TYPE_PUBLIC
      && pool.active
      && pool.expiryTimeMs > Date.now()
      && available
      && amount
      && amount <= BigInt(available),
    );
  }, [
    selectedPool,
    claimAmount,
    selectedPoolClaimAvailableRaw,
    walletContextReady,
    pendingOperation,
    actionBusy,
    userClaimedKnown,
  ]);

  const canCreate = createDerived(() => {
    const stats = platformStats.get();
    const amount = parseGas(createAmount.get());
    const maximum = parseGas(createMaxClaim.get());
    const description = createDescription.get().trim();
    return Boolean(
      stats
      && walletContextReady.get()
      && walletGasBalanceKnown.get()
      && !pendingOperation.get()
      && !actionBusy.get()
      && amount
      && maximum
      && amount >= BigInt(stats.minSponsorshipRaw)
      && amount >= BigInt(GAS_SPONSOR_MIN_CREATE_RAW)
      && amount <= BigInt(walletGasBalanceFixed8.get())
      && maximum <= BigInt(stats.maxClaimPerTxRaw)
      && maximum <= BigInt(GAS_SPONSOR_MAX_CLAIM_RAW)
      && maximum <= amount
      && description.length > 0
      && description.length <= GAS_SPONSOR_DESCRIPTION_MAX_LENGTH,
    );
  }, [
    platformStats,
    walletContextReady,
    walletGasBalanceKnown,
    walletGasBalanceFixed8,
    pendingOperation,
    actionBusy,
    createAmount,
    createMaxClaim,
    createDescription,
  ]);

  const canTopUp = createDerived(() => {
    const stats = platformStats.get();
    const pool = selectedPool.get();
    const amount = parseGas(topUpAmount.get());
    return Boolean(
      stats
      && pool?.isMine
      && pool.active
      && pool.expiryTimeMs > Date.now()
      && walletContextReady.get()
      && walletGasBalanceKnown.get()
      && !pendingOperation.get()
      && !actionBusy.get()
      && amount
      && amount >= BigInt(stats.topUpMinRaw)
      && amount >= BigInt(GAS_SPONSOR_MIN_TOP_UP_RAW)
      && amount <= BigInt(walletGasBalanceFixed8.get()),
    );
  }, [
    platformStats,
    selectedPool,
    topUpAmount,
    walletContextReady,
    walletGasBalanceKnown,
    walletGasBalanceFixed8,
    pendingOperation,
    actionBusy,
  ]);

  const canWithdraw = createDerived(() => {
    const pool = selectedPool.get();
    return Boolean(
      pool?.isMine
      && walletContextReady.get()
      && !pendingOperation.get()
      && !actionBusy.get()
      && BigInt(pool.remainingAmountRaw) > 0n
      && (!pool.active || pool.expiryTimeMs <= Date.now()),
    );
  }, [selectedPool, walletContextReady, pendingOperation, actionBusy]);

  const canExtend = createDerived(() => {
    const pool = selectedPool.get();
    const duration = Number(extendDurationMs.get());
    return Boolean(
      pool?.isMine
      && walletContextReady.get()
      && !pendingOperation.get()
      && !actionBusy.get()
      && BigInt(pool.remainingAmountRaw) > 0n
      && Number.isSafeInteger(duration)
      && duration > 0,
    );
  }, [selectedPool, extendDurationMs, walletContextReady, pendingOperation, actionBusy]);

  const readPool = async (context: GasSponsorChainContext, id: string, ownerHash = walletHash.get()) => {
    const raw = await app.chain.readRaw(
      "getPoolDetails",
      [{ type: "Integer", value: id }],
      { cache: false, scriptHash: context.contractHash },
    );
    return parseGasSponsorPool(raw, id, ownerHash);
  };

  const readUserClaimed = async (context: GasSponsorChainContext, userHash: string, poolId: string) => {
    const raw = await app.chain.readRaw(
      "getUserClaimedFromPool",
      [
        { type: "Hash160", value: userHash },
        { type: "Integer", value: poolId },
      ],
      { cache: false, scriptHash: context.contractHash },
    );
    return gasSponsorUnsigned(raw, "user claimed").toString();
  };

  const loadPlatform = async () => {
    const generation = ++platformGeneration;
    poolsLoading.set(true);
    poolsError.set("");
    try {
      const context = gasSponsorReadContext(app, requestedNetwork);
      const rawStats = await app.chain.readRaw("getPlatformStats", [], {
        cache: false,
        scriptHash: context.contractHash,
      });
      const nextStats = parseGasSponsorPlatformStats(rawStats);
      const lowestId = Math.max(1, nextStats.totalPools - PAGE_SIZE + 1);
      const ids: string[] = [];
      for (let id = nextStats.totalPools; id >= lowestId; id -= 1) ids.push(String(id));
      const ownerHash = walletHash.get();
      const page = await mapWithConcurrency(ids, POOL_READ_CONCURRENCY, (id) => readPool(context, id, ownerHash));
      if (generation !== platformGeneration) return platformStats.get();

      // A wallet can change while the public pool page is loading. Pool data is
      // still valid, but ownership must be derived from the wallet that is
      // current at commit time rather than the address captured before I/O.
      const appliedPage = page.map((pool) => withMine(pool, walletHash.get()));

      network.set(context.network);
      contractHash.set(context.contractHash);
      platformStats.set(nextStats);
      pools.set(appliedPage);
      const cursor = ids.length ? Number(ids[ids.length - 1]) - 1 : 0;
      nextPoolCursor.set(cursor);
      hasMorePools.set(cursor >= 1);
      if (!selectedPoolId.get() && appliedPage[0]) {
        selectedPoolId.set(appliedPage[0].id);
        selectedPool.set(appliedPage[0]);
        withdrawAmount.set(appliedPage[0].remainingAmountRaw);
      } else if (selectedPoolId.get()) {
        const refreshed = appliedPage.find((pool) => pool.id === selectedPoolId.get());
        if (refreshed) {
          selectedPool.set(refreshed);
          withdrawAmount.set(refreshed.remainingAmountRaw);
        }
      }
      return nextStats;
    } catch (error) {
      if (generation === platformGeneration) {
        poolsError.set(app.errors.messageOf(error, t("sponsorPoolsUnavailable")));
      }
      return platformStats.get();
    } finally {
      if (generation === platformGeneration) poolsLoading.set(false);
    }
  };

  const loadMorePools = async () => {
    const cursor = nextPoolCursor.get();
    if (poolsLoading.get() || cursor < 1) return pools.get();
    const generation = ++platformGeneration;
    poolsLoading.set(true);
    poolsError.set("");
    try {
      const context = gasSponsorReadContext(app, requestedNetwork);
      const lowest = Math.max(1, cursor - PAGE_SIZE + 1);
      const ids: string[] = [];
      for (let id = cursor; id >= lowest; id -= 1) ids.push(String(id));
      const ownerHash = walletHash.get();
      const page = await mapWithConcurrency(ids, POOL_READ_CONCURRENCY, (id) => readPool(context, id, ownerHash));
      if (generation !== platformGeneration) return pools.get();
      const appliedPage = page.map((pool) => withMine(pool, walletHash.get()));
      const existing = new Map(pools.get().map((pool) => [pool.id, pool]));
      appliedPage.forEach((pool) => existing.set(pool.id, pool));
      pools.set([...existing.values()].sort((a, b) => Number(BigInt(b.id) - BigInt(a.id))));
      const nextCursor = Number(ids[ids.length - 1]) - 1;
      nextPoolCursor.set(nextCursor);
      hasMorePools.set(nextCursor >= 1);
    } catch (error) {
      if (generation === platformGeneration) {
        poolsError.set(app.errors.messageOf(error, t("sponsorPoolsUnavailable")));
      }
      throw error;
    } finally {
      if (generation === platformGeneration) poolsLoading.set(false);
    }
    return pools.get();
  };

  const selectPool = async (value: string | number) => {
    const id = positiveId(value);
    if (!id) throw new Error(t("sponsorPoolIdInvalid"));
    const generation = ++selectedGeneration;
    selectedPoolLoading.set(true);
    selectedPoolError.set("");
    try {
      const context = gasSponsorReadContext(app, requestedNetwork);
      const ownerHash = walletHash.get();
      const poolPromise = readPool(context, id, ownerHash);
      const claimedPromise = ownerHash
        ? readUserClaimed(context, ownerHash, id)
        : Promise.resolve("");
      const [pool, claimed] = await Promise.all([poolPromise, claimedPromise]);
      if (generation !== selectedGeneration || ownerHash !== walletHash.get()) return selectedPool.get();
      selectedPoolId.set(id);
      selectedPool.set(pool);
      withdrawAmount.set(pool.remainingAmountRaw);
      if (ownerHash) {
        userClaimedFixed8.set(claimed);
        userClaimedKnown.set(true);
      } else {
        userClaimedFixed8.set("");
        userClaimedKnown.set(false);
      }
      pools.set(pools.get().map((entry) => entry.id === id ? pool : entry));
      const available = minRaw(
        BigInt(pool.maxClaimPerUserRaw) > BigInt(claimed || "0")
          ? BigInt(pool.maxClaimPerUserRaw) - BigInt(claimed || "0")
          : 0n,
        BigInt(pool.remainingAmountRaw),
      );
      if (available > 0n) {
        claimAmount.set(app.amount.fixed8ToGas(available > 1_000_000n ? 1_000_000n : available));
      }
      return pool;
    } catch (error) {
      if (generation === selectedGeneration) {
        selectedPoolError.set(app.errors.messageOf(error, t("sponsorPoolUnavailable")));
      }
      throw error;
    } finally {
      if (generation === selectedGeneration) selectedPoolLoading.set(false);
    }
  };

  const refreshSelectedPool = async () => {
    const id = selectedPoolId.get();
    return id ? selectPool(id) : null;
  };

  const refreshWalletScope = async (connect = false) => {
    const generation = ++walletGeneration;
    let address = clean(app.chain.address.get());
    if (connect && !address) address = clean(await app.chain.ensureWallet());
    const ownerHash = normalizeGasSponsorAccount(address);
    if (!address || !ownerHash) {
      if (generation !== walletGeneration) return;
      walletAddress.set("");
      walletHash.set("");
      walletContextReady.set(false);
      walletGasBalanceFixed8.set("");
      walletGasBalanceKnown.set(false);
      userClaimedFixed8.set("");
      userClaimedKnown.set(false);
      selectedPool.set(selectedPool.get() ? withMine(selectedPool.get()!, "") : null);
      pools.set(pools.get().map((pool) => withMine(pool, "")));
      return;
    }

    // Clear identity-bound values before any asynchronous verification when
    // the wallet changed. A failed network/balance read must never leave the
    // previous wallet's balance, claim allowance or ownership on screen.
    if (address !== walletAddress.get() || ownerHash !== walletHash.get()) {
      walletAddress.set(address);
      walletHash.set(ownerHash);
      walletContextReady.set(false);
      walletGasBalanceFixed8.set("");
      walletGasBalanceKnown.set(false);
      userClaimedFixed8.set("");
      userClaimedKnown.set(false);
      selectedPool.set(selectedPool.get() ? withMine(selectedPool.get()!, ownerHash) : null);
      pools.set(pools.get().map((pool) => withMine(pool, ownerHash)));
    }

    try {
      const context = await requireWritableGasSponsorContext(app, requestedNetwork);
      const rawBalancePromise = app.wallet.raw("GAS", address);
      const selectedId = selectedPoolId.get();
      const claimedPromise = selectedId
        ? readUserClaimed(context, ownerHash, selectedId)
        : Promise.resolve("");
      const [rawBalance, claimed] = await Promise.all([rawBalancePromise, claimedPromise]);
      if (generation !== walletGeneration || clean(app.chain.address.get()) !== address) return;
      if (rawBalance < 0n) throw new Error("Invalid wallet GAS balance.");
      const stableContext = await requireWritableGasSponsorContext(app, requestedNetwork);
      if (
        generation !== walletGeneration
        || stableContext.network !== context.network
        || stableContext.contractHash !== context.contractHash
        || clean(app.chain.address.get()) !== address
      ) return;
      walletAddress.set(address);
      walletHash.set(ownerHash);
      walletContextReady.set(true);
      walletGasBalanceFixed8.set(rawBalance.toString());
      walletGasBalanceKnown.set(true);
      if (selectedPoolId.get() === selectedId) {
        userClaimedFixed8.set(claimed);
        userClaimedKnown.set(Boolean(selectedId));
      } else {
        // The claim read belongs to the old selection. Keep the new selection
        // explicitly unknown until its own read completes.
        userClaimedFixed8.set("");
        userClaimedKnown.set(false);
      }
      selectedPool.set(selectedPool.get() ? withMine(selectedPool.get()!, ownerHash) : null);
      pools.set(pools.get().map((pool) => withMine(pool, ownerHash)));
    } catch {
      if (generation === walletGeneration) walletContextReady.set(false);
      // Preserve every verified wallet/pool value for the same address. The
      // false context gate prevents writes while network detection/readback is unavailable.
    }
  };

  const connectWallet = async () => {
    await refreshWalletScope(true);
    if (!walletContextReady.get()) throw new Error(t("sponsorWalletContextMismatch"));
    return walletAddress.get();
  };

  const assertRecoveryStorage = () => {
    const probe = { version: 1, at: Date.now() };
    app.storage.local.set(STORAGE_PROBE_KEY, probe);
    const stored = app.storage.local.get<typeof probe | null>(STORAGE_PROBE_KEY, null);
    app.storage.local.delete(STORAGE_PROBE_KEY);
    if (!stored || stored.version !== probe.version || stored.at !== probe.at) {
      throw new Error(t("sponsorRecoveryStorageUnavailable"));
    }
  };

  const persistPending = (value: PendingGasSponsorOperation | null) => {
    if (value && !isPendingGasSponsorOperation(value)) throw new Error(t("sponsorPendingInvalid"));
    if (value) {
      app.storage.local.set(PENDING_STORAGE_KEY, value);
      const stored = app.storage.local.get<unknown>(PENDING_STORAGE_KEY, null);
      if (!isPendingGasSponsorOperation(stored) || JSON.stringify(stored) !== JSON.stringify(value)) {
        throw new Error(t("sponsorRecoveryStorageUnavailable"));
      }
    } else {
      app.storage.local.delete(PENDING_STORAGE_KEY);
      if (app.storage.local.get(PENDING_STORAGE_KEY, null) !== null) {
        throw new Error(t("sponsorRecoveryStorageUnavailable"));
      }
    }
    pendingOperation.set(value);
  };

  const setPendingOutcome = (pending: PendingGasSponsorOperation, messageKey = "sponsorOperationPending") => {
    outcome.set({
      status: "pending",
      operation: pending.kind,
      message: t(messageKey),
      txid: pending.txid,
      paymentTxid: pending.paymentTxid,
      poolId: pending.poolId,
      amountRaw: pending.amountRaw,
    });
  };

  const setConfirmedOutcome = (pending: PendingGasSponsorOperation, poolId = pending.poolId) => {
    persistPending(null);
    outcome.set({
      status: "confirmed",
      operation: pending.kind,
      message: t("sponsorOperationConfirmed"),
      txid: pending.txid,
      paymentTxid: pending.paymentTxid,
      poolId,
      amountRaw: pending.amountRaw,
    });
  };

  const setFailedOutcome = (pending: PendingGasSponsorOperation, messageKey: string) => {
    outcome.set({
      status: "failed",
      operation: pending.kind,
      message: t(messageKey),
      txid: pending.txid,
      paymentTxid: pending.paymentTxid,
      poolId: pending.poolId,
      amountRaw: pending.amountRaw,
    });
  };

  const eventForPending = (
    pending: PendingGasSponsorOperation,
    transaction: GasSponsorTransactionOutcome,
  ): GasSponsorNotification | null => {
    const eventName = pending.kind === "create"
      ? "SponsorshipCreated"
      : pending.kind === "claim"
        ? "SponsorshipClaimed"
        : pending.kind === "withdraw"
          ? "PoolRefunded"
          : pending.kind === "extend"
            ? "PoolExtended"
            : "";
    return eventName ? findGasSponsorNotification(transaction, pending.contractHash, eventName) : null;
  };

  const verifyEvent = (pending: PendingGasSponsorOperation, event: GasSponsorNotification): string => {
    if (pending.kind === "create") {
      const poolId = positiveId(gasSponsorNotificationValue(event, 2));
      if (
        !poolId
        || !gasSponsorAccountsMatch(gasSponsorNotificationValue(event, 0), pending.walletHash)
        || gasSponsorUnsigned(gasSponsorNotificationValue(event, 1), "created amount").toString() !== pending.amountRaw
        || gasSponsorSafeInteger(gasSponsorNotificationValue(event, 3), "created pool type") !== GAS_SPONSOR_POOL_TYPE_PUBLIC
      ) throw new Error(t("sponsorEventMismatch"));
      return poolId;
    }
    if (pending.kind === "claim") {
      if (
        !gasSponsorAccountsMatch(gasSponsorNotificationValue(event, 0), pending.walletHash)
        || gasSponsorUnsigned(gasSponsorNotificationValue(event, 1), "claimed amount").toString() !== pending.amountRaw
        || positiveId(gasSponsorNotificationValue(event, 2)) !== pending.poolId
      ) throw new Error(t("sponsorEventMismatch"));
      return pending.poolId!;
    }
    if (pending.kind === "withdraw") {
      if (
        positiveId(gasSponsorNotificationValue(event, 0)) !== pending.poolId
        || !gasSponsorAccountsMatch(gasSponsorNotificationValue(event, 1), pending.walletHash)
        || gasSponsorUnsigned(gasSponsorNotificationValue(event, 2), "refunded amount").toString() !== pending.baselineRemainingRaw
      ) throw new Error(t("sponsorEventMismatch"));
      return pending.poolId!;
    }
    if (pending.kind === "extend") {
      if (
        positiveId(gasSponsorNotificationValue(event, 0)) !== pending.poolId
        || gasSponsorSafeInteger(gasSponsorNotificationValue(event, 1), "new expiry") !== pending.newExpiryMs
      ) throw new Error(t("sponsorEventMismatch"));
      return pending.poolId!;
    }
    return pending.poolId!;
  };

  const discoverCreatedPool = async (pending: PendingGasSponsorOperation) => {
    const context: GasSponsorChainContext = {
      network: pending.network,
      contractHash: pending.contractHash,
      gasHash: pending.gasHash,
    };
    const stats = parseGasSponsorPlatformStats(await app.chain.readRaw("getPlatformStats", [], {
      cache: false,
      scriptHash: pending.contractHash,
    }));
    if (stats.totalPools <= pending.baselinePoolCount) return null;
    const newest = stats.totalPools;
    const oldest = Math.max(pending.baselinePoolCount + 1, newest - 19);
    const ids: string[] = [];
    for (let id = newest; id >= oldest; id -= 1) ids.push(String(id));
    const candidates = await mapWithConcurrency(ids, POOL_READ_CONCURRENCY, (id) =>
      readPool(context, id, pending.walletHash));
    const matches = candidates.filter((pool) =>
      pool.isMine
      && pool.poolType === GAS_SPONSOR_POOL_TYPE_PUBLIC
      && BigInt(pool.initialAmountRaw) >= BigInt(pending.amountRaw!)
      && pool.maxClaimPerUserRaw === pending.maxClaimRaw
      && pool.description === pending.description);
    return matches.length === 1 ? matches[0] : null;
  };

  const verifyReadback = async (pending: PendingGasSponsorOperation, eventPoolId = "") => {
    const context: GasSponsorChainContext = {
      network: pending.network,
      contractHash: pending.contractHash,
      gasHash: pending.gasHash,
    };
    if (pending.kind === "create") {
      const pool = eventPoolId
        ? await readPool(context, eventPoolId, pending.walletHash)
        : await discoverCreatedPool(pending);
      if (
        !pool
        || !pool.isMine
        || pool.poolType !== GAS_SPONSOR_POOL_TYPE_PUBLIC
        || BigInt(pool.initialAmountRaw) < BigInt(pending.amountRaw!)
        || pool.maxClaimPerUserRaw !== pending.maxClaimRaw
        || pool.description !== pending.description
      ) throw new Error(t("sponsorReadbackMismatch"));
      return pool;
    }

    const pool = await readPool(context, pending.poolId!, pending.walletHash);
    if (pending.kind === "claim") {
      const claimed = await readUserClaimed(context, pending.walletHash, pending.poolId!);
      const expectedClaimed = BigInt(pending.baselineUserClaimedRaw!) + BigInt(pending.amountRaw!);
      const expectedTotal = BigInt(pending.baselineClaimedRaw!) + BigInt(pending.amountRaw!);
      if (BigInt(claimed) < expectedClaimed || BigInt(pool.totalClaimedRaw) < expectedTotal) {
        throw new Error(t("sponsorReadbackMismatch"));
      }
      return pool;
    }
    if (pending.kind === "topUp") {
      const expectedRemaining = BigInt(pending.baselineRemainingRaw!) + BigInt(pending.amountRaw!);
      const expectedInitial = BigInt(pending.baselineInitialRaw!) + BigInt(pending.amountRaw!);
      if (BigInt(pool.remainingAmountRaw) < expectedRemaining || BigInt(pool.initialAmountRaw) < expectedInitial) {
        throw new Error(t("sponsorReadbackMismatch"));
      }
      return pool;
    }
    if (pending.kind === "withdraw") {
      if (pool.remainingAmountRaw !== "0" || pool.active) throw new Error(t("sponsorReadbackMismatch"));
      return pool;
    }
    if (pending.kind === "extend") {
      if (pool.expiryTimeMs < pending.newExpiryMs!) throw new Error(t("sponsorReadbackMismatch"));
      return pool;
    }
    throw new Error(t("sponsorReadbackMismatch"));
  };

  const applyVerifiedPool = (pool: GasSponsorPool) => {
    selectedPoolId.set(pool.id);
    selectedPool.set(withMine(pool, walletHash.get()));
    withdrawAmount.set(pool.remainingAmountRaw);
    const entries = new Map(pools.get().map((entry) => [entry.id, entry]));
    entries.set(pool.id, withMine(pool, walletHash.get()));
    pools.set([...entries.values()].sort((a, b) => Number(BigInt(b.id) - BigInt(a.id))));
  };

  const recoverPendingOperation = async (immediateEvent?: GasSponsorNotification | null) => {
    const pending = pendingOperation.get();
    if (!pending) return { status: "none" as const };
    const currentContext = gasSponsorReadContext(app, requestedNetwork);
    if (
      pending.network !== currentContext.network
      || pending.contractHash !== currentContext.contractHash
      || pending.gasHash !== currentContext.gasHash
    ) {
      outcome.set({
        status: "unknown",
        operation: pending.kind,
        message: t("sponsorPendingContextMismatch"),
        txid: pending.txid,
        paymentTxid: pending.paymentTxid,
        poolId: pending.poolId,
        amountRaw: pending.amountRaw,
      });
      return { status: "context-mismatch" as const };
    }
    const currentWallet = normalizeGasSponsorAccount(app.chain.address.get());
    if (currentWallet && !gasSponsorAccountsMatch(currentWallet, pending.walletHash)) {
      outcome.set({
        status: "unknown",
        operation: pending.kind,
        message: t("sponsorPendingWalletMismatch"),
        txid: pending.txid,
        paymentTxid: pending.paymentTxid,
        poolId: pending.poolId,
        amountRaw: pending.amountRaw,
      });
      return { status: "wallet-mismatch" as const };
    }

    if (pending.phase === "payment-broadcast" || pending.phase === "payment-confirmed") {
      const payment = await transactionOutcomeReader(pending.network, pending.paymentTxid!);
      if (payment.state === "unknown") {
        setPendingOutcome(pending, "sponsorPaymentConfirmationPending");
        return { status: "pending" as const };
      }
      if (payment.state === "fault") {
        persistPending(null);
        setFailedOutcome(pending, "sponsorPaymentFault");
        return { status: "fault" as const };
      }
      const transfer = findGasSponsorNotification(payment, pending.gasHash, "Transfer");
      const exactTransfer = transfer
        && gasSponsorAccountsMatch(gasSponsorNotificationValue(transfer, 0), pending.walletHash)
        && gasSponsorAccountsMatch(gasSponsorNotificationValue(transfer, 1), pending.contractHash)
        && gasSponsorUnsigned(gasSponsorNotificationValue(transfer, 2), "payment amount").toString() === pending.amountRaw;
      if (!exactTransfer) {
        outcome.set({
          status: "unknown",
          operation: pending.kind,
          message: t("sponsorPaymentReviewRequired"),
          paymentTxid: pending.paymentTxid,
          poolId: pending.poolId,
          amountRaw: pending.amountRaw,
        });
        return { status: "review" as const };
      }
      const confirmedPayment: PendingGasSponsorOperation = {
        ...pending,
        phase: "payment-confirmed",
      };
      persistPending(confirmedPayment);
      setPendingOutcome(confirmedPayment, "sponsorPaymentResumeRequired");
      return { status: "resume" as const };
    }

    const transaction = immediateEvent
      ? { state: "halt" as const, notifications: [immediateEvent] }
      : await transactionOutcomeReader(pending.network, pending.txid!);
    if (transaction.state === "unknown") {
      setPendingOutcome(pending, "sponsorOperationPending");
      return { status: "pending" as const };
    }
    if (transaction.state === "fault") {
      if (pending.paymentTxid && (pending.kind === "create" || pending.kind === "topUp")) {
        const resumable = { ...pending, phase: "payment-confirmed" as const, txid: undefined };
        persistPending(resumable);
        setFailedOutcome(resumable, "sponsorActionFaultCreditRetained");
        return { status: "resume" as const };
      }
      persistPending(null);
      setFailedOutcome(pending, "sponsorActionFault");
      return { status: "fault" as const };
    }

    try {
      const event = immediateEvent ?? eventForPending(pending, transaction);
      const eventPoolId = event ? verifyEvent(pending, event) : "";
      const verifiedPool = await verifyReadback(pending, eventPoolId);
      applyVerifiedPool(verifiedPool);
      if (pending.kind === "claim") {
        const claimed = await readUserClaimed(currentContext, pending.walletHash, verifiedPool.id);
        userClaimedFixed8.set(claimed);
        userClaimedKnown.set(true);
      }
      setConfirmedOutcome(pending, verifiedPool.id);
      await loadPlatform();
      return { status: "confirmed" as const, pool: verifiedPool };
    } catch {
      outcome.set({
        status: "unknown",
        operation: pending.kind,
        message: t("sponsorOperationReviewRequired"),
        txid: pending.txid,
        paymentTxid: pending.paymentTxid,
        poolId: pending.poolId,
        amountRaw: pending.amountRaw,
      });
      return { status: "review" as const };
    }
  };

  const writableScope = async () => {
    if (pendingOperation.get()) throw new Error(t("sponsorPendingBlocksWrites"));
    assertRecoveryStorage();
    const address = clean(await app.chain.ensureWallet());
    const actorHash = normalizeGasSponsorAccount(address);
    const observableHash = normalizeGasSponsorAccount(app.chain.address.get());
    if (!actorHash || !observableHash || !gasSponsorAccountsMatch(actorHash, observableHash)) {
      throw new Error(t("sponsorWalletContextMismatch"));
    }
    const context = await requireWritableGasSponsorContext(app, requestedNetwork);
    return { address, actorHash, context };
  };

  const assertWritableScopeStable = async (context: GasSponsorChainContext, actorHash: string) => {
    const currentWallet = normalizeGasSponsorAccount(app.chain.address.get());
    if (!currentWallet || !gasSponsorAccountsMatch(currentWallet, actorHash)) {
      throw new Error(t("sponsorWalletContextMismatch"));
    }
    const currentContext = await requireWritableGasSponsorContext(app, requestedNetwork);
    if (
      currentContext.network !== context.network
      || currentContext.contractHash !== context.contractHash
      || currentContext.gasHash !== context.gasHash
    ) throw new Error(t("sponsorPendingContextMismatch"));
  };

  const runWrite = async <T>(kind: GasSponsorOperationKind, work: () => Promise<T>) => {
    if (actionBusy.get()) return null;
    actionBusy.set(true);
    outcome.set({ status: "pending", operation: kind, message: t("sponsorWalletApprovalPending") });
    try {
      return await work();
    } catch (error) {
      const pending = pendingOperation.get();
      if (pending) {
        outcome.set({
          status: "unknown",
          operation: pending.kind,
          message: t("sponsorOperationPending"),
          txid: pending.txid,
          paymentTxid: pending.paymentTxid,
          poolId: pending.poolId,
          amountRaw: pending.amountRaw,
        });
        return null;
      }
      outcome.set({
        status: "failed",
        operation: kind,
        message: app.errors.messageOf(error, t("sponsorOperationFailed")),
      });
      throw error;
    } finally {
      actionBusy.set(false);
    }
  };

  const persistPaymentBroadcast = (draft: Omit<PendingGasSponsorOperation, "phase" | "paymentTxid" | "txid">, txid: string) => {
    const paymentTxid = normalizeGasSponsorTxid(txid);
    if (!paymentTxid) throw new Error(t("sponsorTransactionIdInvalid"));
    const record: PendingGasSponsorOperation = { ...draft, phase: "payment-broadcast", paymentTxid };
    persistPending(record);
    setPendingOutcome(record, "sponsorPaymentConfirmationPending");
  };

  const persistActionBroadcast = (
    draft: Omit<PendingGasSponsorOperation, "phase" | "paymentTxid" | "txid">,
    txid: string,
  ) => {
    const actionTxid = normalizeGasSponsorTxid(txid);
    if (!actionTxid) throw new Error(t("sponsorTransactionIdInvalid"));
    const paymentTxid = pendingOperation.get()?.paymentTxid;
    const record: PendingGasSponsorOperation = {
      ...draft,
      phase: "target-broadcast",
      txid: actionTxid,
      ...(paymentTxid ? { paymentTxid } : {}),
    };
    persistPending(record);
    setPendingOutcome(record);
  };

  const createPublicPool = async () => runWrite("create", async () => {
    const { address, actorHash, context } = await writableScope();
    const rawStats = await app.chain.readRaw("getPlatformStats", [], {
      cache: false,
      scriptHash: context.contractHash,
    });
    const stats = parseGasSponsorPlatformStats(rawStats);
    const amount = parseGas(createAmount.get());
    const maximum = parseGas(createMaxClaim.get());
    const description = createDescription.get().trim();
    if (
      !amount
      || amount < BigInt(stats.minSponsorshipRaw)
      || amount < BigInt(GAS_SPONSOR_MIN_CREATE_RAW)
      || !maximum
      || maximum > BigInt(stats.maxClaimPerTxRaw)
      || maximum > BigInt(GAS_SPONSOR_MAX_CLAIM_RAW)
      || maximum > amount
      || description.length === 0
      || description.length > GAS_SPONSOR_DESCRIPTION_MAX_LENGTH
    ) throw new Error(t("sponsorCreateInvalid"));
    const walletBalance = await app.wallet.raw("GAS", address);
    if (walletBalance < amount) throw new Error(t("sponsorInsufficientGas"));
    const draft = {
      version: 2 as const,
      kind: "create" as const,
      network: context.network,
      contractHash: context.contractHash,
      gasHash: context.gasHash,
      walletHash: actorHash,
      createdAtMs: Date.now(),
      amountRaw: amount.toString(),
      maxClaimRaw: maximum.toString(),
      description,
      baselinePoolCount: stats.totalPools,
    };
    await assertWritableScopeStable(context, actorHash);
    const result = await app.chain.invokeWithPayment(
      amount.toString(),
      GAS_SPONSOR_PAYMENT_MEMO,
      "createPool",
      [
        { type: "Hash160", value: actorHash },
        { type: "Integer", value: amount.toString() },
        { type: "Integer", value: maximum.toString() },
        { type: "Integer", value: String(GAS_SPONSOR_POOL_TYPE_PUBLIC) },
        { type: "String", value: description },
      ],
      {
        scriptHash: context.contractHash,
        waitForEvent: "SponsorshipCreated",
        waitTimeoutMs: EVENT_WAIT_MS,
        onPaymentSent: (txid) => persistPaymentBroadcast(draft, txid),
        onTransactionSent: (txid) => persistActionBroadcast(draft, txid),
      },
    );
    if (!pendingOperation.get() && result.txid) persistActionBroadcast(draft, result.txid);
    const pending = pendingOperation.get();
    if (!pending) throw new Error(t("sponsorRecoveryStorageUnavailable"));
    const immediate = eventFromImmediate(app, context.contractHash, "SponsorshipCreated", result.event);
    await recoverPendingOperation(immediate);
    if (outcome.get().status === "confirmed") {
      createAmount.set("1");
      createMaxClaim.set("0.05");
      createDescription.set(t("defaultPoolDescription"));
      mode.set("browse");
    }
    return result;
  });

  const claimFromSelectedPool = async () => runWrite("claim", async () => {
    const { actorHash, context } = await writableScope();
    const poolId = positiveId(selectedPoolId.get());
    if (!poolId) throw new Error(t("sponsorPoolIdInvalid"));
    const [pool, claimed] = await Promise.all([
      readPool(context, poolId, actorHash),
      readUserClaimed(context, actorHash, poolId),
    ]);
    const amount = parseGas(claimAmount.get());
    const available = minRaw(
      BigInt(pool.maxClaimPerUserRaw) > BigInt(claimed)
        ? BigInt(pool.maxClaimPerUserRaw) - BigInt(claimed)
        : 0n,
      BigInt(pool.remainingAmountRaw),
    );
    if (
      pool.poolType !== GAS_SPONSOR_POOL_TYPE_PUBLIC
      || !pool.active
      || pool.expiryTimeMs <= Date.now()
      || !amount
      || amount > available
    ) throw new Error(t("sponsorClaimInvalid"));
    const draft = {
      version: 2 as const,
      kind: "claim" as const,
      network: context.network,
      contractHash: context.contractHash,
      gasHash: context.gasHash,
      walletHash: actorHash,
      createdAtMs: Date.now(),
      poolId,
      amountRaw: amount.toString(),
      baselinePoolCount: platformStats.get()?.totalPools ?? gasSponsorSafeInteger(
        (await app.chain.readRaw("getPoolCount", [], { cache: false, scriptHash: context.contractHash })),
        "pool count",
      ),
      baselineInitialRaw: pool.initialAmountRaw,
      baselineRemainingRaw: pool.remainingAmountRaw,
      baselineClaimedRaw: pool.totalClaimedRaw,
      baselineUserClaimedRaw: claimed,
    };
    await assertWritableScopeStable(context, actorHash);
    const result = await app.chain.invoke(
      "claimSponsorship",
      [
        { type: "Hash160", value: actorHash },
        { type: "Integer", value: poolId },
        { type: "Integer", value: amount.toString() },
      ],
      {
        scriptHash: context.contractHash,
        waitForEvent: "SponsorshipClaimed",
        waitTimeoutMs: EVENT_WAIT_MS,
        onTransactionSent: (txid) => persistActionBroadcast(draft, txid),
      },
    );
    if (!pendingOperation.get() && result.txid) persistActionBroadcast(draft, result.txid);
    const immediate = eventFromImmediate(app, context.contractHash, "SponsorshipClaimed", result.event);
    await recoverPendingOperation(immediate);
    return result;
  });

  const topUpSelectedPool = async () => runWrite("topUp", async () => {
    const { address, actorHash, context } = await writableScope();
    const poolId = positiveId(selectedPoolId.get());
    if (!poolId) throw new Error(t("sponsorPoolIdInvalid"));
    const [pool, stats] = await Promise.all([
      readPool(context, poolId, actorHash),
      app.chain.readRaw("getPlatformStats", [], { cache: false, scriptHash: context.contractHash })
        .then((raw) => parseGasSponsorPlatformStats(raw)),
    ]);
    const amount = parseGas(topUpAmount.get());
    if (
      !pool.isMine
      || !pool.active
      || pool.expiryTimeMs <= Date.now()
      || !amount
      || amount < BigInt(stats.topUpMinRaw)
      || amount < BigInt(GAS_SPONSOR_MIN_TOP_UP_RAW)
    ) {
      throw new Error(t("sponsorTopUpInvalid"));
    }
    const walletBalance = await app.wallet.raw("GAS", address);
    if (walletBalance < amount) throw new Error(t("sponsorInsufficientGas"));
    const draft = {
      version: 2 as const,
      kind: "topUp" as const,
      network: context.network,
      contractHash: context.contractHash,
      gasHash: context.gasHash,
      walletHash: actorHash,
      createdAtMs: Date.now(),
      poolId,
      amountRaw: amount.toString(),
      baselinePoolCount: stats.totalPools,
      baselineInitialRaw: pool.initialAmountRaw,
      baselineRemainingRaw: pool.remainingAmountRaw,
      baselineClaimedRaw: pool.totalClaimedRaw,
    };
    await assertWritableScopeStable(context, actorHash);
    const result = await app.chain.invokeWithPayment(
      amount.toString(),
      GAS_SPONSOR_PAYMENT_MEMO,
      "topUpPool",
      [
        { type: "Hash160", value: actorHash },
        { type: "Integer", value: poolId },
        { type: "Integer", value: amount.toString() },
      ],
      {
        scriptHash: context.contractHash,
        onPaymentSent: (txid) => persistPaymentBroadcast(draft, txid),
        onTransactionSent: (txid) => persistActionBroadcast(draft, txid),
      },
    );
    if (!pendingOperation.get() && result.txid) persistActionBroadcast(draft, result.txid);
    await recoverPendingOperation();
    return result;
  });

  const withdrawSelectedPool = async () => runWrite("withdraw", async () => {
    const { actorHash, context } = await writableScope();
    const poolId = positiveId(selectedPoolId.get());
    if (!poolId) throw new Error(t("sponsorPoolIdInvalid"));
    const pool = await readPool(context, poolId, actorHash);
    if (!pool.isMine || BigInt(pool.remainingAmountRaw) <= 0n || (pool.active && pool.expiryTimeMs > Date.now())) {
      throw new Error(t("sponsorWithdrawInvalid"));
    }
    const draft = {
      version: 2 as const,
      kind: "withdraw" as const,
      network: context.network,
      contractHash: context.contractHash,
      gasHash: context.gasHash,
      walletHash: actorHash,
      createdAtMs: Date.now(),
      poolId,
      baselinePoolCount: platformStats.get()?.totalPools ?? 0,
      baselineInitialRaw: pool.initialAmountRaw,
      baselineRemainingRaw: pool.remainingAmountRaw,
      baselineClaimedRaw: pool.totalClaimedRaw,
    };
    await assertWritableScopeStable(context, actorHash);
    const result = await app.chain.invoke(
      "withdrawPool",
      [
        { type: "Hash160", value: actorHash },
        { type: "Integer", value: poolId },
      ],
      {
        scriptHash: context.contractHash,
        waitForEvent: "PoolRefunded",
        waitTimeoutMs: EVENT_WAIT_MS,
        onTransactionSent: (txid) => persistActionBroadcast(draft, txid),
      },
    );
    if (!pendingOperation.get() && result.txid) persistActionBroadcast(draft, result.txid);
    const immediate = eventFromImmediate(app, context.contractHash, "PoolRefunded", result.event);
    await recoverPendingOperation(immediate);
    return result;
  });

  const extendSelectedPool = async () => runWrite("extend", async () => {
    const { actorHash, context } = await writableScope();
    const poolId = positiveId(selectedPoolId.get());
    if (!poolId) throw new Error(t("sponsorPoolIdInvalid"));
    const pool = await readPool(context, poolId, actorHash);
    const durationMs = Number(extendDurationMs.get());
    const newExpiryMs = Math.max(Date.now(), pool.expiryTimeMs) + durationMs;
    if (
      !pool.isMine
      || BigInt(pool.remainingAmountRaw) <= 0n
      || !Number.isSafeInteger(durationMs)
      || durationMs <= 0
      || !Number.isSafeInteger(newExpiryMs)
    ) throw new Error(t("sponsorExtendInvalid"));
    const draft = {
      version: 2 as const,
      kind: "extend" as const,
      network: context.network,
      contractHash: context.contractHash,
      gasHash: context.gasHash,
      walletHash: actorHash,
      createdAtMs: Date.now(),
      poolId,
      newExpiryMs,
      baselinePoolCount: platformStats.get()?.totalPools ?? 0,
      baselineInitialRaw: pool.initialAmountRaw,
      baselineRemainingRaw: pool.remainingAmountRaw,
      baselineClaimedRaw: pool.totalClaimedRaw,
      baselineExpiryMs: pool.expiryTimeMs,
    };
    await assertWritableScopeStable(context, actorHash);
    const result = await app.chain.invoke(
      "extendPoolExpiry",
      [
        { type: "Integer", value: poolId },
        { type: "Integer", value: String(newExpiryMs) },
      ],
      {
        scriptHash: context.contractHash,
        waitForEvent: "PoolExtended",
        waitTimeoutMs: EVENT_WAIT_MS,
        onTransactionSent: (txid) => persistActionBroadcast(draft, txid),
      },
    );
    if (!pendingOperation.get() && result.txid) persistActionBroadcast(draft, result.txid);
    const immediate = eventFromImmediate(app, context.contractHash, "PoolExtended", result.event);
    await recoverPendingOperation(immediate);
    return result;
  });

  /**
   * Resume the target call after an already-confirmed prepaid transfer. This
   * path never calls invokeWithPayment, so a refresh cannot pay twice.
   */
  const resumePendingAction = async () => {
    const pending = pendingOperation.get();
    if (!pending || pending.phase !== "payment-confirmed" || (pending.kind !== "create" && pending.kind !== "topUp")) {
      throw new Error(t("sponsorNoResumablePayment"));
    }
    const recovery = await recoverPendingOperation();
    if (recovery.status !== "resume") throw new Error(t("sponsorPaymentNotConfirmed"));
    return runWrite(pending.kind, async () => {
      const address = clean(await app.chain.ensureWallet());
      const actorHash = normalizeGasSponsorAccount(address);
      const context = await requireWritableGasSponsorContext(app, requestedNetwork);
      if (
        !gasSponsorAccountsMatch(actorHash, pending.walletHash)
        || context.network !== pending.network
        || context.contractHash !== pending.contractHash
      ) throw new Error(t("sponsorPendingContextMismatch"));
      const args = pending.kind === "create"
        ? [
            { type: "Hash160" as const, value: pending.walletHash },
            { type: "Integer" as const, value: pending.amountRaw! },
            { type: "Integer" as const, value: pending.maxClaimRaw! },
            { type: "Integer" as const, value: String(GAS_SPONSOR_POOL_TYPE_PUBLIC) },
            { type: "String" as const, value: pending.description! },
          ]
        : [
            { type: "Hash160" as const, value: pending.walletHash },
            { type: "Integer" as const, value: pending.poolId! },
            { type: "Integer" as const, value: pending.amountRaw! },
          ];
      await assertWritableScopeStable(context, actorHash);
      const result = await app.chain.invoke(
        pending.kind === "create" ? "createPool" : "topUpPool",
        args,
        {
          scriptHash: pending.contractHash,
          ...(pending.kind === "create"
            ? { waitForEvent: "SponsorshipCreated", waitTimeoutMs: EVENT_WAIT_MS }
            : {}),
          onTransactionSent: (txid) => {
            const actionTxid = normalizeGasSponsorTxid(txid);
            if (!actionTxid) throw new Error(t("sponsorTransactionIdInvalid"));
            const actionPending: PendingGasSponsorOperation = {
              ...pending,
              phase: "target-broadcast",
              txid: actionTxid,
            };
            persistPending(actionPending);
            setPendingOutcome(actionPending);
          },
        },
      );
      if (pendingOperation.get()?.phase === "payment-confirmed" && result.txid) {
        const actionTxid = normalizeGasSponsorTxid(result.txid);
        if (!actionTxid) throw new Error(t("sponsorTransactionIdInvalid"));
        persistPending({ ...pending, phase: "target-broadcast", txid: actionTxid });
      }
      const immediate = pending.kind === "create"
        ? eventFromImmediate(app, pending.contractHash, "SponsorshipCreated", result.event)
        : null;
      await recoverPendingOperation(immediate);
      return result;
    });
  };

  const dismissOutcome = () => {
    if (!pendingOperation.get()) outcome.set({ status: "idle", operation: null, message: "" });
  };

  const unsubscribeWallet = app.chain.address.subscribe(() => {
    selectedGeneration += 1;
    walletGeneration += 1;
    walletContextReady.set(false);
    const nextAddress = clean(app.chain.address.get());
    if (nextAddress !== walletAddress.get()) {
      const nextHash = normalizeGasSponsorAccount(nextAddress);
      walletAddress.set(nextAddress);
      walletHash.set(nextHash);
      walletGasBalanceFixed8.set("");
      walletGasBalanceKnown.set(false);
      userClaimedFixed8.set("");
      userClaimedKnown.set(false);
      selectedPool.set(selectedPool.get() ? withMine(selectedPool.get()!, nextHash) : null);
      pools.set(pools.get().map((pool) => withMine(pool, nextHash)));
    }
    void refreshWalletScope(false);
  });
  app.lifecycle.cleanup(unsubscribeWallet);

  const loadAll = async () => {
    await Promise.all([loadPlatform(), refreshWalletScope(false)]);
    if (pendingOperation.get()) await recoverPendingOperation();
  };

  return {
    mode,
    network,
    contractHash,
    platformStats,
    pools,
    poolsLoading,
    poolsError,
    hasMorePools,
    nextPoolCursor,
    selectedPoolId,
    selectedPool,
    selectedPoolLoading,
    selectedPoolError,
    walletAddress,
    walletHash,
    walletContextReady,
    walletGasBalanceFixed8,
    walletGasBalanceKnown,
    userClaimedFixed8,
    userClaimedKnown,
    pendingOperation,
    outcome,
    actionBusy,
    claimAmount,
    createAmount,
    createMaxClaim,
    createDescription,
    topUpAmount,
    extendDurationMs,
    withdrawAmount,
    canClaim,
    canCreate,
    canTopUp,
    canWithdraw,
    canExtend,
    selectedPoolIsMine,
    selectedPoolExpired,
    selectedPoolRemainingFixed8,
    selectedPoolClaimAvailableRaw,
    canResumePending,
    loadPlatform,
    loadMorePools,
    selectPool,
    refreshSelectedPool,
    refreshWalletScope,
    connectWallet,
    claimFromSelectedPool,
    createPublicPool,
    topUpSelectedPool,
    withdrawSelectedPool,
    extendSelectedPool,
    recoverPendingOperation,
    resumePendingAction,
    dismissOutcome,
    loadAll,
  };
}

export type UseGasSponsorAppReturn = ReturnType<typeof useGasSponsorApp>;
