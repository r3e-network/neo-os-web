import { createObservable, type Observable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import {
  aaMarketAccountMatches,
  findAAMarketNotification,
  isPendingAAMarketOperation,
  normalizeAAMarketAccount,
  notificationValue,
  parseChainHash160,
  readAAMarketRpc,
  requireCanonicalAAMarketContext,
  waitForAAMarketTransactionOutcome,
  type AAMarketContext,
  type AAMarketNotification,
  type AAMarketTransactionOutcome,
  type PendingAAMarketOperation,
} from "../aa-market-safety";
import {
  buyAddressListing,
  cancelAddressListing,
  createAddressListing,
  formatGasFractions,
  getDefaultAAContractHash,
  getDefaultMarketHash,
  listAddressListings,
  parseGasToFractions,
  readAddressListing,
  refundPendingAddressPurchase,
  updateAddressListingPrice,
  type MarketListing,
} from "../utils/aa-market";

export type MarketMode = "explore" | "sell";
export type MarketDataSource = "idle" | "chain" | "partial" | "failed";
export type AAMarketActionResult =
  | { status: "confirmed"; txid: string }
  | { status: "pending"; txid: string }
  | { status: "fault"; txid: string }
  | { status: "confirmation-required"; txid: "" };

export interface UseAAMarketHubOptions {
  app: MiniAppFramework;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function derived<T>(get: () => T, dependencies: Observable<unknown>[]): Observable<T> {
  return {
    get,
    set: () => {},
    subscribe: (listener) => {
      const unsubs = dependencies.map((dependency) => dependency.subscribe(listener));
      return () => unsubs.forEach((unsubscribe) => unsubscribe());
    },
  };
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function integer(value: unknown): string {
  const raw = clean(value);
  if (!/^\d+$/.test(raw)) return "";
  return BigInt(raw).toString();
}

function eventInteger(event: AAMarketNotification, index: number): string {
  return integer(notificationValue(event, index));
}

function zeroHash(value: unknown): boolean {
  const parsed = parseChainHash160(value, true);
  return /^0x0{40}$/i.test(parsed);
}

function txidFrom(result: unknown): string {
  return clean((result as { txid?: unknown } | null)?.txid);
}

function rpcInteger(value: string) {
  return { type: "Integer", value };
}

function rpcHash(value: string) {
  return { type: "Hash160", value };
}

function errorText(
  error: unknown,
  app: UseAAMarketHubOptions["app"],
  t: UseAAMarketHubOptions["t"],
  fallbackKey: string,
): string {
  const message = error instanceof Error ? clean(error.message) : clean(error);
  // utils/aa-market throws this one as a bare i18n key — localize it here.
  if (message === "aaMarketChainContextMismatch") return t("aaMarketChainContextMismatch");
  // messageOf maps chain/RPC failures onto the localized family copy
  // notify.error shows; internal throws already carry t() copy and pass
  // through verbatim.
  return app.errors.messageOf(error, t(fallbackKey));
}

export function useAAMarketHub({ app, t }: UseAAMarketHubOptions) {
  const mode = createObservable<MarketMode>("explore");
  const network = createObservable("");
  const marketHash = createObservable("");
  const aaContractHash = createObservable("");
  const accountIdHash = createObservable("");
  const priceGas = createObservable("1");
  const listingTitle = createObservable("");
  const metadataUri = createObservable("");
  const nextPriceGas = createObservable("");
  const newBackupOwner = createObservable("");
  const selectedListingId = createObservable("");
  const listings = createObservable<MarketListing[]>([]);
  const totalOnChainListings = createObservable(0);
  const listingsTruncated = createObservable(false);
  const failedListingReads = createObservable(0);
  const dataSource = createObservable<MarketDataSource>("idle");
  const isLoading = createObservable(false);
  const isWalletConnecting = createObservable(false);
  const isSubmitting = createObservable(false);
  const isRecovering = createObservable(false);
  const activeAction = createObservable("");
  const lastError = createObservable("");
  const lastSuccess = createObservable("");
  const transactionNotice = createObservable("");
  const cancelConfirmationId = createObservable("");
  const recoveryStorageHealthy = createObservable(true);
  let writeInFlight: {
    kind: PendingAAMarketOperation["kind"];
    promise: Promise<AAMarketActionResult>;
  } | null = null;
  let listingsLoadGeneration = 0;
  let listingsReloadQueued = false;
  let disposed = false;

  const pendingOperation = app.state.persisted<PendingAAMarketOperation | null>(
    "pendingOperation",
    null,
  );
  const pendingStorageKey = "state/pendingOperation";
  const pendingStorageProbeKey = "state/pendingOperationProbe";
  let storageProbeSequence = 0;

  const storageWritable = (): boolean => {
    const token = `${Date.now()}:${++storageProbeSequence}`;
    try {
      app.storage.local.set(pendingStorageProbeKey, token);
      const written = app.storage.local.get<string>(pendingStorageProbeKey, "") === token;
      app.storage.local.delete(pendingStorageProbeKey);
      const cleared = app.storage.local.get<unknown>(pendingStorageProbeKey, null) === null;
      return written && cleared;
    } catch {
      return false;
    }
  };

  const pendingRecordsMatch = (
    stored: unknown,
    expected: PendingAAMarketOperation | null,
  ): boolean => {
    if (expected === null) return stored === null;
    return isPendingAAMarketOperation(stored) && JSON.stringify(stored) === JSON.stringify(expected);
  };

  const writePending = (value: PendingAAMarketOperation | null): boolean => {
    try {
      pendingOperation.set(value);
    } catch {
      // The observable remains useful for this session even when its storage
      // subscriber throws. Exact storage readback below determines durability.
    }
    let durable = false;
    try {
      durable = storageWritable() && pendingRecordsMatch(
        app.storage.local.get<unknown>(pendingStorageKey, null),
        value,
      );
    } catch {
      durable = false;
    }
    recoveryStorageHealthy.set(durable);
    return durable;
  };

  if (pendingOperation.get() && !isPendingAAMarketOperation(pendingOperation.get())) {
    writePending(null);
  }

  const walletAddress: Observable<string> = {
    get: () => app.chain.address.get() || "",
    set: () => {},
    subscribe: (listener) => app.chain.address.subscribe(listener),
  };

  const selectedListing = derived<MarketListing | null>(
    () => listings.get().find((listing) => listing.id === selectedListingId.get()) ?? null,
    [listings, selectedListingId],
  );

  const activeListingsDisplay = derived(
    () => listings.get().filter((listing) => listing.status === "active").length,
    [listings],
  );
  const totalListingsDisplay = derived(
    () => totalOnChainListings.get() || listings.get().length,
    [totalOnChainListings, listings],
  );
  const canCreateListing = derived(
    () => {
      try {
        return Boolean(
          normalizeAAMarketAccount(accountIdHash.get()) &&
          parseGasToFractions(priceGas.get()) &&
          listingTitle.get().trim().length <= 80 &&
          metadataUri.get().trim().length <= 240 &&
          !pendingOperation.get(),
        );
      } catch {
        return false;
      }
    },
    [accountIdHash, priceGas, listingTitle, metadataUri, pendingOperation],
  );
  const canManageSelectedListing = derived(
    () => Boolean(
      selectedListing.get()?.status === "active" &&
      selectedListing.get()?.isMine &&
      selectedListing.get()?.isCanonicalAA &&
      !pendingOperation.get(),
    ),
    [selectedListing, pendingOperation],
  );
  const selectedListingHasPendingRefund = derived(
    () => {
      const listing = selectedListing.get();
      return Boolean(
        listing?.pendingPaymentKnown &&
        BigInt(listing.myPendingPayment || "0") > 0n,
      );
    },
    [selectedListing],
  );
  const canBuySelectedListing = derived(
    () => {
      const listing = selectedListing.get();
      return Boolean(
        listing && listing.status === "active" && !listing.isMine &&
        listing.isCanonicalAA && listing.pendingPaymentKnown &&
        BigInt(listing.myPendingPayment || "0") === 0n &&
        !pendingOperation.get(),
      );
    },
    [selectedListing, pendingOperation],
  );
  const marketHashDisplay = derived(
    () => marketHash.get() ? `${marketHash.get().slice(0, 10)}…${marketHash.get().slice(-8)}` : "—",
    [marketHash],
  );
  const walletDisplay = derived(
    () => walletAddress.get() ? `${walletAddress.get().slice(0, 9)}…${walletAddress.get().slice(-6)}` : t("notConnected"),
    [walletAddress],
  );
  const selectedListingDisplay = derived(
    () => selectedListing.get() ? `#${selectedListing.get()!.id}` : "—",
    [selectedListing],
  );
  const listingsTruncatedNotice = derived(
    () => listingsTruncated.get()
      ? t("listingsTruncatedNotice", { shown: listings.get().length, total: totalOnChainListings.get() })
      : failedListingReads.get() > 0
        ? t("partialListingsNotice", { failed: failedListingReads.get() })
        : "",
    [listingsTruncated, listings, totalOnChainListings, failedListingReads],
  );

  const setFailure = (error: unknown, fallbackKey = "actionFailed") => {
    lastSuccess.set("");
    if (!pendingOperation.get()) transactionNotice.set("");
    lastError.set(errorText(error, app, t, fallbackKey));
  };
  const setPendingNotice = (key = "transactionPending") => {
    lastError.set("");
    lastSuccess.set("");
    transactionNotice.set(t(key));
  };
  const setSuccess = (kind: PendingAAMarketOperation["kind"]) => {
    lastError.set("");
    transactionNotice.set("");
    lastSuccess.set(t(`confirmed_${kind}`));
  };

  const setContext = (context: AAMarketContext) => {
    network.set(context.network);
    marketHash.set(context.marketHash);
    aaContractHash.set(context.aaCoreHash);
  };

  const context = async () => {
    const next = await requireCanonicalAAMarketContext(app);
    setContext(next);
    return next;
  };

  const writableContext = async () => {
    const next = await requireCanonicalAAMarketContext(
      app,
      t("aaMarketNetworkUnverified"),
      { requireDetectedNetwork: true },
    );
    setContext(next);
    return next;
  };

  const walletSnapshot = async () => {
    const wallet = await app.chain.ensureWallet();
    const actorHash = normalizeAAMarketAccount(wallet);
    const current = await writableContext();
    if (!actorHash) throw new Error(t("walletInvalid"));
    return { wallet, actorHash, context: current };
  };

  const assertNoPending = () => {
    if (pendingOperation.get()) throw new Error(t("pendingBlocksWrites"));
  };

  const exclusiveWrite = (
    kind: PendingAAMarketOperation["kind"],
    task: () => Promise<AAMarketActionResult>,
  ): Promise<AAMarketActionResult> => {
    if (writeInFlight) {
      if (writeInFlight.kind === kind) return writeInFlight.promise;
      return Promise.reject(new Error(t("operationInProgress")));
    }
    if (isRecovering.get() || isWalletConnecting.get()) {
      return Promise.reject(new Error(t("operationInProgress")));
    }
    try {
      assertNoPending();
    } catch (error) {
      return Promise.reject(error);
    }
    isSubmitting.set(true);
    activeAction.set(kind);
    lastError.set("");
    lastSuccess.set("");
    const promise = Promise.resolve()
      .then(task)
      .finally(() => {
        if (writeInFlight?.promise === promise) writeInFlight = null;
        isSubmitting.set(false);
        activeAction.set("");
      });
    writeInFlight = { kind, promise };
    return promise;
  };

  const walletMatchesSnapshot = (snapshot: string): boolean => {
    const current = walletAddress.get();
    if (!snapshot && !current) return true;
    return aaMarketAccountMatches(snapshot, current);
  };

  const assertWriteSnapshot = async (
    actorHash: string,
    expected: AAMarketContext,
  ): Promise<void> => {
    if (!aaMarketAccountMatches(walletAddress.get(), actorHash)) {
      throw new Error(t("walletChangedBeforeSubmission"));
    }
    const current = await writableContext();
    if (
      current.network !== expected.network ||
      !aaMarketAccountMatches(current.marketHash, expected.marketHash) ||
      !aaMarketAccountMatches(current.aaCoreHash, expected.aaCoreHash) ||
      !aaMarketAccountMatches(current.gasHash, expected.gasHash)
    ) {
      throw new Error(t("aaMarketChainContextMismatch"));
    }
  };

  const persist = (
    draft: Omit<PendingAAMarketOperation, "txid">,
    transactionId: string,
  ): PendingAAMarketOperation | null => {
    const candidate = { ...draft, txid: clean(transactionId) };
    if (!isPendingAAMarketOperation(candidate)) return null;
    const durable = writePending(candidate);
    setPendingNotice(durable ? "transactionPending" : "pendingStorageUnavailable");
    return candidate;
  };

  const pendingContextMatches = async (pending: PendingAAMarketOperation) => {
    const current = await context();
    const actor = normalizeAAMarketAccount(walletAddress.get());
    return Boolean(
      actor &&
      pending.network === current.network &&
      aaMarketAccountMatches(pending.marketHash, current.marketHash) &&
      aaMarketAccountMatches(pending.aaCoreHash, current.aaCoreHash) &&
      aaMarketAccountMatches(pending.gasHash, current.gasHash) &&
      aaMarketAccountMatches(pending.actorHash, actor),
    );
  };

  const readCore = (
    pending: PendingAAMarketOperation,
    operation: string,
    accountIdHash: string,
  ) => readAAMarketRpc(
    {
      network: pending.network,
      marketHash: pending.marketHash,
      aaCoreHash: pending.aaCoreHash,
      gasHash: "",
    },
    pending.aaCoreHash,
    operation,
    [rpcHash(accountIdHash)],
  );

  const coreEscrowState = async (pending: PendingAAMarketOperation, accountIdHash: string) => {
    const [backupOwner, escrowContract, escrowListingId, active, verifier, hook] = await Promise.all([
      readCore(pending, "getBackupOwner", accountIdHash),
      readCore(pending, "getMarketEscrowContract", accountIdHash),
      readCore(pending, "getMarketEscrowListingId", accountIdHash),
      readCore(pending, "isMarketEscrowActive", accountIdHash),
      readCore(pending, "getVerifier", accountIdHash),
      readCore(pending, "getHook", accountIdHash),
    ]);
    if (typeof active !== "boolean") throw new Error("Malformed AA market escrow state.");
    return {
      backupOwner: parseChainHash160(backupOwner, true),
      escrowContract: parseChainHash160(escrowContract, true),
      escrowListingId: integer(escrowListingId),
      active,
      verifier,
      hook,
    };
  };

  const transferMatches = (
    outcome: AAMarketTransactionOutcome,
    pending: PendingAAMarketOperation,
    from: string,
    to: string,
    amount: string,
  ) => Boolean(findAAMarketNotification(outcome, pending.gasHash || "", "Transfer", (event) =>
    aaMarketAccountMatches(notificationValue(event, 0), from) &&
    aaMarketAccountMatches(notificationValue(event, 1), to) &&
    eventInteger(event, 2) === amount,
  ));

  const confirmPendingReadback = async (
    pending: PendingAAMarketOperation,
    outcome: AAMarketTransactionOutcome,
  ): Promise<boolean> => {
    if (outcome.state !== "halt") return false;
    if (pending.kind === "create") {
      const event = findAAMarketNotification(outcome, pending.aaCoreHash, "MarketEscrowEntered", (candidate) =>
        aaMarketAccountMatches(notificationValue(candidate, 0), pending.accountIdHash) &&
        aaMarketAccountMatches(notificationValue(candidate, 1), pending.marketHash) &&
        Boolean(eventInteger(candidate, 2)),
      );
      if (!event) return false;
      const listingId = eventInteger(event, 2);
      if (BigInt(listingId) <= BigInt(pending.beforeListingCount!)) return false;
      const listing = await readAddressListing(app, pending.marketHash, listingId);
      const escrow = await coreEscrowState(pending, pending.accountIdHash!);
      if (
        listing.id !== listingId || listing.status !== "active" ||
        !listing.isCanonicalAA ||
        !aaMarketAccountMatches(listing.accountIdHash, pending.accountIdHash) ||
        !aaMarketAccountMatches(listing.seller, pending.actorHash) ||
        listing.priceRaw !== pending.priceRaw ||
        listing.title !== clean(pending.title) || listing.metadataUri !== clean(pending.metadataUri) ||
        !escrow.active || !aaMarketAccountMatches(escrow.escrowContract, pending.marketHash) ||
        escrow.escrowListingId !== listingId
      ) return false;
      writePending({ ...pending, listingId });
      return true;
    }

    const listing = await readAddressListing(app, pending.marketHash, pending.listingId!);
    if (!aaMarketAccountMatches(listing.accountIdHash, pending.accountIdHash)) return false;

    if (pending.kind === "update") {
      return listing.status === "active" && listing.priceRaw === pending.priceRaw &&
        BigInt(listing.updatedAt) > BigInt(pending.beforeUpdatedAt!);
    }

    const escrow = await coreEscrowState(pending, pending.accountIdHash!);
    if (pending.kind === "cancel") {
      const event = findAAMarketNotification(outcome, pending.aaCoreHash, "MarketEscrowCancelled", (candidate) =>
        aaMarketAccountMatches(notificationValue(candidate, 0), pending.accountIdHash),
      );
      return Boolean(event && listing.status === "cancelled" && !escrow.active);
    }

    if (pending.kind === "buy") {
      const event = findAAMarketNotification(outcome, pending.aaCoreHash, "MarketEscrowSettled", (candidate) =>
        aaMarketAccountMatches(notificationValue(candidate, 0), pending.accountIdHash) &&
        aaMarketAccountMatches(notificationValue(candidate, 1), pending.newBackupOwnerHash),
      );
      const pendingPayment = await readAAMarketRpc(
        { network: pending.network, marketHash: pending.marketHash, aaCoreHash: pending.aaCoreHash, gasHash: pending.gasHash },
        pending.marketHash,
        "getPendingPaymentOf",
        [rpcInteger(pending.listingId!), rpcHash(pending.actorHash)],
      );
      return Boolean(
        event && listing.status === "sold" &&
        aaMarketAccountMatches(listing.buyer, pending.actorHash) &&
        integer(pendingPayment) === "0" && !escrow.active &&
        aaMarketAccountMatches(escrow.backupOwner, pending.newBackupOwnerHash) &&
        zeroHash(escrow.verifier) && zeroHash(escrow.hook) &&
        transferMatches(outcome, pending, pending.actorHash, pending.marketHash, pending.priceRaw!) &&
        transferMatches(outcome, pending, pending.marketHash, pending.sellerHash!, pending.priceRaw!),
      );
    }

    const payment = await readAAMarketRpc(
      { network: pending.network, marketHash: pending.marketHash, aaCoreHash: pending.aaCoreHash, gasHash: pending.gasHash },
      pending.marketHash,
      "getPendingPaymentOf",
      [rpcInteger(pending.listingId!), rpcHash(pending.actorHash)],
    );
    return integer(payment) === "0" && transferMatches(
      outcome,
      pending,
      pending.marketHash,
      pending.actorHash,
      pending.pendingPaymentRaw!,
    );
  };

  const settlePending = async (
    pending: PendingAAMarketOperation,
    outcome?: AAMarketTransactionOutcome,
  ): Promise<AAMarketActionResult> => {
    writePending(pending);
    if (!(await pendingContextMatches(pending))) {
      setPendingNotice("pendingContextMismatch");
      return { status: "pending", txid: pending.txid };
    }
    const resolved = outcome ?? await waitForAAMarketTransactionOutcome(pending);
    if (resolved.state === "fault") {
      writePending(null);
      transactionNotice.set("");
      lastSuccess.set("");
      lastError.set(t("transactionFaulted"));
      return { status: "fault", txid: pending.txid };
    }
    if (resolved.state !== "halt") {
      setPendingNotice();
      return { status: "pending", txid: pending.txid };
    }
    try {
      if (!(await confirmPendingReadback(pending, resolved))) {
        setPendingNotice("pendingReadback");
        return { status: "pending", txid: pending.txid };
      }
    } catch {
      setPendingNotice("pendingReadback");
      return { status: "pending", txid: pending.txid };
    }
    const resolvedPending = pendingOperation.get() ?? pending;
    writePending(null);
    setSuccess(resolvedPending.kind);
    await loadListings().catch(() => undefined);
    return { status: "confirmed", txid: resolvedPending.txid };
  };

  const runWrite = async (
    draft: Omit<PendingAAMarketOperation, "txid">,
    invoke: (onTransactionSent: (txid: string) => void) => Promise<{ txid: string }>,
  ): Promise<AAMarketActionResult> => {
    assertNoPending();
    let tracked: PendingAAMarketOperation | null = null;
    try {
      const result = await invoke((id) => { tracked = persist(draft, id); });
      tracked ??= persist(draft, txidFrom(result));
      if (!tracked) throw new Error(t("transactionIdMissing"));
      return await settlePending(tracked);
    } catch (error) {
      const pending = tracked ?? pendingOperation.get();
      if (pending) return settlePending(pending);
      setFailure(error);
      throw error;
    }
  };

  function selectListing(listing: MarketListing) {
    selectedListingId.set(listing.id);
    nextPriceGas.set(listing.priceGas);
    newBackupOwner.set(walletAddress.get());
    cancelConfirmationId.set("");
  }

  async function connectWallet() {
    if (writeInFlight || isRecovering.get()) throw new Error(t("operationInProgress"));
    if (isWalletConnecting.get()) throw new Error(t("operationInProgress"));
    isWalletConnecting.set(true);
    try {
      const address = await app.chain.ensureWallet();
      await writableContext();
      newBackupOwner.set(address);
      await loadListings();
      if (pendingOperation.get()) await recoverPendingOperation();
      return address;
    } catch (error) {
      setFailure(error, "connectFailed");
      throw error;
    } finally {
      isWalletConnecting.set(false);
    }
  }

  async function loadListings() {
    if (isLoading.get()) {
      listingsReloadQueued = true;
      return;
    }
    listingsReloadQueued = false;
    const generation = ++listingsLoadGeneration;
    const loadingWallet = walletAddress.get();
    isLoading.set(true);
    lastError.set("");
    try {
      const current = await context();
      const result = await listAddressListings(app, current.marketHash, loadingWallet);
      const latest = await requireCanonicalAAMarketContext(app);
      if (
        disposed || generation !== listingsLoadGeneration ||
        !walletMatchesSnapshot(loadingWallet) || latest.network !== current.network ||
        !aaMarketAccountMatches(latest.marketHash, current.marketHash) ||
        !aaMarketAccountMatches(latest.aaCoreHash, current.aaCoreHash)
      ) {
        listingsReloadQueued = !disposed;
        return;
      }
      setContext(latest);
      listings.set(result.listings);
      totalOnChainListings.set(result.total);
      listingsTruncated.set(result.truncated);
      failedListingReads.set(result.failedReads);
      dataSource.set(result.source);
      const selected = result.listings.find((listing) => listing.id === selectedListingId.get());
      const preferred = selected ?? result.listings.find((listing) => listing.status === "active") ?? result.listings[0];
      if (preferred) selectListing(preferred);
      else selectedListingId.set("");
    } catch (error) {
      if (disposed || generation !== listingsLoadGeneration || !walletMatchesSnapshot(loadingWallet)) {
        listingsReloadQueued = !disposed;
        return;
      }
      dataSource.set("failed");
      setFailure(error, "loadListingsFailed");
      throw error;
    } finally {
      isLoading.set(false);
      if (listingsReloadQueued && !disposed) {
        listingsReloadQueued = false;
        void loadListings().catch(() => undefined);
      }
    }
  }

  const freshListing = async (id: string, actorHash: string) => {
    const current = await context();
    const listing = await readAddressListing(app, current.marketHash, id, actorHash);
    if (!listing.isCanonicalAA) throw new Error(t("nonCanonicalListing"));
    if (listing.status !== "active") throw new Error(t("listingNoLongerActive"));
    return { listing, context: current };
  };

  async function submitCreateListingCore() {
    const { wallet, actorHash, context: current } = await walletSnapshot();
    const accountId = normalizeAAMarketAccount(accountIdHash.get());
    if (!accountId) throw new Error(t("invalidHashInput"));
    const [backupOwner, active, beforeCount] = await Promise.all([
      readAAMarketRpc(current, current.aaCoreHash, "getBackupOwner", [rpcHash(accountId)]),
      readAAMarketRpc(current, current.aaCoreHash, "isMarketEscrowActive", [rpcHash(accountId)]),
      readAAMarketRpc(current, current.marketHash, "getListingCount"),
    ]);
    if (!aaMarketAccountMatches(backupOwner, actorHash)) throw new Error(t("notAccountOwner"));
    if (typeof active !== "boolean") throw new Error(t("accountStateInvalid"));
    if (active) throw new Error(t("accountAlreadyListed"));
    const beforeListingCount = integer(beforeCount);
    if (!beforeListingCount) throw new Error(t("listingCountInvalid"));
    const priceRaw = parseGasToFractions(priceGas.get());
    const draft: Omit<PendingAAMarketOperation, "txid"> = {
      version: 1,
      kind: "create",
      network: current.network,
      marketHash: current.marketHash,
      aaCoreHash: current.aaCoreHash,
      gasHash: current.gasHash,
      actorHash,
      createdAt: Date.now(),
      accountIdHash: accountId,
      priceRaw,
      title: listingTitle.get().trim(),
      metadataUri: metadataUri.get().trim(),
      beforeListingCount,
    };
    await assertWriteSnapshot(actorHash, current);
    const result = await runWrite(draft, (onTransactionSent) =>
      createAddressListing(app, current.marketHash, wallet, {
        aaContractHash: current.aaCoreHash,
        accountIdHash: accountId,
        priceGas: priceGas.get(),
        title: draft.title,
        metadataUri: draft.metadataUri,
      }, { onTransactionSent }),
    );
    if (result.status === "confirmed") {
      accountIdHash.set("");
      listingTitle.set("");
      metadataUri.set("");
      mode.set("explore");
    }
    return result;
  }

  async function submitUpdatePriceCore() {
    const selected = selectedListing.get();
    if (!selected) throw new Error(t("selectListingHint"));
    const { wallet, actorHash } = await walletSnapshot();
    const { listing, context: current } = await freshListing(selected.id, actorHash);
    if (!listing.isMine) throw new Error(t("notListingSeller"));
    const priceRaw = parseGasToFractions(nextPriceGas.get());
    const draft: Omit<PendingAAMarketOperation, "txid"> = {
      version: 1, kind: "update", network: current.network,
      marketHash: current.marketHash, aaCoreHash: current.aaCoreHash, gasHash: current.gasHash,
      actorHash, createdAt: Date.now(), listingId: listing.id,
      accountIdHash: listing.accountIdHash, priceRaw, beforeUpdatedAt: listing.updatedAt,
    };
    await assertWriteSnapshot(actorHash, current);
    return runWrite(draft, (onTransactionSent) =>
      updateAddressListingPrice(app, current.marketHash, wallet, listing.id, nextPriceGas.get(), { onTransactionSent }),
    );
  }

  async function submitCancelSelectedCore() {
    const selected = selectedListing.get();
    if (!selected) throw new Error(t("selectListingHint"));
    if (cancelConfirmationId.get() !== selected.id) {
      cancelConfirmationId.set(selected.id);
      return { status: "confirmation-required", txid: "" } as const;
    }
    const { wallet, actorHash } = await walletSnapshot();
    const { listing, context: current } = await freshListing(selected.id, actorHash);
    if (!listing.isMine) throw new Error(t("notListingSeller"));
    const draft: Omit<PendingAAMarketOperation, "txid"> = {
      version: 1, kind: "cancel", network: current.network,
      marketHash: current.marketHash, aaCoreHash: current.aaCoreHash, gasHash: current.gasHash,
      actorHash, createdAt: Date.now(), listingId: listing.id, accountIdHash: listing.accountIdHash,
    };
    cancelConfirmationId.set("");
    await assertWriteSnapshot(actorHash, current);
    return runWrite(draft, (onTransactionSent) =>
      cancelAddressListing(app, current.marketHash, wallet, listing.id, { onTransactionSent }),
    );
  }

  async function submitBuySelectedCore() {
    const selected = selectedListing.get();
    if (!selected) throw new Error(t("selectListingHint"));
    const { wallet, actorHash } = await walletSnapshot();
    const { listing, context: current } = await freshListing(selected.id, actorHash);
    if (listing.isMine) throw new Error(t("cannotBuyOwnListing"));
    if (!listing.pendingPaymentKnown) throw new Error(t("pendingPaymentUnknown"));
    if (BigInt(listing.myPendingPayment) > 0n) throw new Error(t("refundBeforeBuy"));
    const backupOwner = normalizeAAMarketAccount(newBackupOwner.get() || wallet);
    if (!backupOwner) throw new Error(t("invalidHashInput"));
    const draft: Omit<PendingAAMarketOperation, "txid"> = {
      version: 1, kind: "buy", network: current.network,
      marketHash: current.marketHash, aaCoreHash: current.aaCoreHash, gasHash: current.gasHash,
      actorHash, createdAt: Date.now(), listingId: listing.id,
      accountIdHash: listing.accountIdHash, sellerHash: listing.seller,
      priceRaw: listing.priceRaw, newBackupOwnerHash: backupOwner,
    };
    await assertWriteSnapshot(actorHash, current);
    return runWrite(draft, (onTransactionSent) =>
      buyAddressListing(app, current.marketHash, wallet, listing, {
        newBackupOwner: backupOwner,
        onTransactionSent,
      }),
    );
  }

  async function submitRefundSelectedCore() {
    const selected = selectedListing.get();
    if (!selected) throw new Error(t("selectListingHint"));
    const { wallet, actorHash } = await walletSnapshot();
    const current = await context();
    const listing = await readAddressListing(app, current.marketHash, selected.id, actorHash);
    if (!listing.pendingPaymentKnown || BigInt(listing.myPendingPayment) <= 0n) {
      throw new Error(t("noPendingPayment"));
    }
    const draft: Omit<PendingAAMarketOperation, "txid"> = {
      version: 1, kind: "refund", network: current.network,
      marketHash: current.marketHash, aaCoreHash: current.aaCoreHash, gasHash: current.gasHash,
      actorHash, createdAt: Date.now(), listingId: listing.id,
      accountIdHash: listing.accountIdHash, pendingPaymentRaw: listing.myPendingPayment,
    };
    await assertWriteSnapshot(actorHash, current);
    return runWrite(draft, (onTransactionSent) =>
      refundPendingAddressPurchase(app, current.marketHash, wallet, listing.id, { onTransactionSent }),
    );
  }

  const submitCreateListing = () => exclusiveWrite("create", submitCreateListingCore);
  const submitUpdatePrice = () => exclusiveWrite("update", submitUpdatePriceCore);
  const submitCancelSelected = () => exclusiveWrite("cancel", submitCancelSelectedCore);
  const submitBuySelected = () => exclusiveWrite("buy", submitBuySelectedCore);
  const submitRefundSelected = () => exclusiveWrite("refund", submitRefundSelectedCore);

  async function recoverPendingOperation() {
    const pending = pendingOperation.get();
    if (!pending || isRecovering.get() || isSubmitting.get()) return null;
    isRecovering.set(true);
    try {
      const result = await settlePending(pending);
      if (result.status === "confirmed") await loadListings().catch(() => undefined);
      return result;
    } finally {
      isRecovering.set(false);
    }
  }

  async function loadAll() {
    try {
      const current = await context();
      marketHash.set(current.marketHash || getDefaultMarketHash(current.network));
      aaContractHash.set(current.aaCoreHash || getDefaultAAContractHash(current.network));
      newBackupOwner.set(walletAddress.get());
      await loadListings();
      if (pendingOperation.get() && walletAddress.get()) await recoverPendingOperation();
    } catch (error) {
      setFailure(error, "loadListingsFailed");
    }
  }

  const walletUnsubscribe = app.chain.address.subscribe(() => {
    listingsLoadGeneration += 1;
    listingsReloadQueued = true;
    newBackupOwner.set(walletAddress.get());
    cancelConfirmationId.set("");
    if (pendingOperation.get()) setPendingNotice("pendingWalletCheck");
    if (!disposed) void loadListings().catch(() => undefined);
  });

  return {
    mode, network, marketHash, aaContractHash, accountIdHash, priceGas,
    listingTitle, metadataUri, nextPriceGas, newBackupOwner,
    selectedListingId, listings, totalOnChainListings, listingsTruncated,
    failedListingReads, dataSource, isLoading, isWalletConnecting, isSubmitting,
    isRecovering, activeAction, lastError, lastSuccess, transactionNotice,
    cancelConfirmationId, pendingOperation, recoveryStorageHealthy, walletAddress, selectedListing,
    activeListingsDisplay, totalListingsDisplay, canCreateListing,
    canManageSelectedListing, selectedListingHasPendingRefund,
    canBuySelectedListing, marketHashDisplay, walletDisplay,
    selectedListingDisplay, listingsTruncatedNotice, formatGasFractions,
    selectListing, connectWallet, loadListings, submitCreateListing,
    submitUpdatePrice, submitCancelSelected, submitBuySelected,
    submitRefundSelected, recoverPendingOperation, loadAll,
    cleanup: () => {
      disposed = true;
      walletUnsubscribe();
    },
    reportFailure: setFailure,
  };
}

export type UseAAMarketHubReturn = ReturnType<typeof useAAMarketHub>;
