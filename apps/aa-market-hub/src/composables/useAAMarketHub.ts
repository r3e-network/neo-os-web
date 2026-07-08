/**
 * useAAMarketHub -- Domain logic for AA Market Hub
 *
 * Uses createObservable instead of Vue ref/computed/watch.
 * Called once during setup, returns observables that React components subscribe to.
 *
 * All chain traffic rides the framework (app.chain reads/writes, the
 * transfer-then-settle buy via app.chain.invokeMultiple) and every write runs
 * inside an app.operations operation that owns its busy flag and toast keys —
 * the runWriteAction hand-roll and its dead eventBus emits are retired.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import {
  buyAddressListing,
  cancelAddressListing,
  createAddressListing,
  formatGasFractions,
  getDefaultAAContractHash,
  getDefaultMarketHash,
  listAddressListings,
  refundPendingAddressPurchase,
  type MarketListing,
  updateAddressListingPrice,
} from "../utils/aa-market";
import {
  addressToScriptHash,
  normalizeScriptHash,
  parseHash160,
} from "@shared/utils/neo";

// Config persistence rides app.storage.local. main.tsx pins
// `storagePrefix: "aa-market-hub:"`, so these keys resolve to the exact
// pre-framework localStorage entries ("aa-market-hub:market-hash" /
// "aa-market-hub:aa-contract-hash") — existing user overrides keep working.
const MARKET_HASH_STORAGE_KEY = "market-hash";
const AA_HASH_STORAGE_KEY = "aa-contract-hash";

export interface UseAAMarketHubOptions {
  app: MiniAppFramework;
  t: (key: string, params?: Record<string, string | number>) => string;
}

type MarketWriteOperation = ReturnType<MiniAppFramework["operations"]["create"]>;

/**
 * Read-only boolean observable that is true while the operation runs — the
 * drop-in replacement for the hand-rolled per-action busy flags (`set` is a
 * no-op; the operation state is the single source of truth).
 */
function operationRunning(op: MarketWriteOperation): Observable<boolean> {
  return {
    get: () => op.state.get().status === "running",
    set: () => {},
    subscribe: (fn) => op.state.subscribe(fn),
  };
}

export function useAAMarketHub({ app, t }: UseAAMarketHubOptions) {
  // Form state
  const marketHash = createObservable("");
  const aaContractHash = createObservable(getDefaultAAContractHash());
  const accountIdHash = createObservable("");
  const priceGas = createObservable("");
  const listingTitle = createObservable("");
  const metadataUri = createObservable("");
  const nextPriceGas = createObservable("");
  const newBackupOwner = createObservable("");
  const selectedListingId = createObservable("");
  const listings = createObservable<MarketListing[]>([]);
  const totalOnChainListings = createObservable(0);
  const listingsTruncated = createObservable(false);
  const isLoading = createObservable(false);
  const isWalletConnecting = createObservable(false);

  // One framework operation per write so the four manage buttons spin
  // independently instead of all at once; the shared isSubmitting flag
  // derives from all of them (the legacy flag was set for every write).
  const createListingOp = app.operations.create("createListing");
  const updatePriceOp = app.operations.create("updatePrice");
  const cancelListingOp = app.operations.create("cancelListing");
  const buyListingOp = app.operations.create("buyListing");
  const refundPendingOp = app.operations.create("refundPending");
  const writeOps = [
    createListingOp,
    updatePriceOp,
    cancelListingOp,
    buyListingOp,
    refundPendingOp,
  ];

  const isSubmitting: Observable<boolean> = {
    get: () => writeOps.some((op) => op.state.get().status === "running"),
    set: () => {},
    subscribe: (fn) => {
      const unsubs = writeOps.map((op) => op.state.subscribe(fn));
      return () => {
        unsubs.forEach((unsub) => unsub());
      };
    },
  };
  const isUpdatingPrice = operationRunning(updatePriceOp);
  const isCancelling = operationRunning(cancelListingOp);
  const isBuying = operationRunning(buyListingOp);
  const isRefunding = operationRunning(refundPendingOp);

  const walletAddress: Observable<string> = {
    get: () => app.chain.address.get() || "",
    set: () => {},
    subscribe: (fn) => app.chain.address.subscribe(fn),
  };

  const selectedListing: Observable<MarketListing | null> = {
    get: () =>
      listings.get().find((l) => l.id === selectedListingId.get()) ?? null,
    set: () => {},
    subscribe: (fn) => {
      const u1 = listings.subscribe(fn);
      const u2 = selectedListingId.subscribe(fn);
      return () => {
        u1();
        u2();
      };
    },
  };

  const selectedListingHasPendingRefund: Observable<boolean> = {
    get: () => {
      const sl = selectedListing.get();
      const pending = sl?.myPendingPayment || "0";
      return BigInt(pending) > 0n;
    },
    set: () => {},
    subscribe: (fn) => selectedListing.subscribe(fn),
  };

  const canCreateListing: Observable<boolean> = {
    get: () =>
      Boolean(
        marketHash.get().trim() &&
        aaContractHash.get().trim() &&
        accountIdHash.get().trim() &&
        priceGas.get().trim(),
      ),
    set: () => {},
    subscribe: (fn) => {
      const u1 = marketHash.subscribe(fn);
      const u2 = aaContractHash.subscribe(fn);
      const u3 = accountIdHash.subscribe(fn);
      const u4 = priceGas.subscribe(fn);
      return () => {
        u1();
        u2();
        u3();
        u4();
      };
    },
  };

  const canManageSelectedListing: Observable<boolean> = {
    get: () => {
      const sl = selectedListing.get();
      return Boolean(sl && sl.status === "active" && sl.isMine);
    },
    set: () => {},
    subscribe: (fn) => selectedListing.subscribe(fn),
  };

  const canBuySelectedListing: Observable<boolean> = {
    get: () => {
      const sl = selectedListing.get();
      return Boolean(sl && sl.status === "active" && !sl.isMine);
    },
    set: () => {},
    subscribe: (fn) => selectedListing.subscribe(fn),
  };

  // Display values
  const totalListingsDisplay: Observable<number> = {
    get: () => {
      const total = totalOnChainListings.get();
      return total > 0 ? total : listings.get().length;
    },
    set: () => {},
    subscribe: (fn) => {
      const u1 = listings.subscribe(fn);
      const u2 = totalOnChainListings.subscribe(fn);
      return () => {
        u1();
        u2();
      };
    },
  };

  const listingsTruncatedNotice: Observable<string> = {
    get: () => {
      if (!listingsTruncated.get()) return "";
      return t("listingsTruncatedNotice", {
        shown: listings.get().length,
        total: totalOnChainListings.get(),
      });
    },
    set: () => {},
    subscribe: (fn) => {
      const u1 = listings.subscribe(fn);
      const u2 = listingsTruncated.subscribe(fn);
      const u3 = totalOnChainListings.subscribe(fn);
      return () => {
        u1();
        u2();
        u3();
      };
    },
  };

  const activeListingsDisplay: Observable<number> = {
    get: () => listings.get().filter((l) => l.status === "active").length,
    set: () => {},
    subscribe: (fn) => listings.subscribe(fn),
  };

  const marketHashDisplay: Observable<string> = {
    get: () => {
      const hash = marketHash.get() || "";
      if (!hash || hash.length <= 21) return hash || t("notAvailable");
      return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
    },
    set: () => {},
    subscribe: (fn) => marketHash.subscribe(fn),
  };

  const walletDisplay: Observable<string> = {
    get: () => {
      const addr = walletAddress.get();
      if (!addr || addr.length <= 21) return addr || t("notAvailable");
      return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
    },
    set: () => {},
    subscribe: () => () => {},
  };

  const selectedListingDisplay: Observable<string> = {
    get: () => {
      const sl = selectedListing.get();
      return sl ? `#${sl.id}` : t("notAvailable");
    },
    set: () => {},
    subscribe: (fn) => selectedListing.subscribe(fn),
  };

  // Persistence
  function persistConfig() {
    app.storage.local.set(MARKET_HASH_STORAGE_KEY, marketHash.get().trim());
    app.storage.local.set(AA_HASH_STORAGE_KEY, aaContractHash.get().trim());
  }

  function readStoredString(key: string): string {
    const cached = app.storage.local.get<string>(key);
    return typeof cached === "string" ? cached : "";
  }

  // Subscribe to config changes for persistence
  const unsubMarket = marketHash.subscribe(persistConfig);
  const unsubAA = aaContractHash.subscribe(persistConfig);

  function selectListing(listing: MarketListing) {
    selectedListingId.set(listing.id);
    nextPriceGas.set(listing.priceGas);
    newBackupOwner.set(walletAddress.get());
  }

  // Actions
  async function connectWallet() {
    try {
      isWalletConnecting.set(true);
      await app.chain.ensureWallet();
      newBackupOwner.set(walletAddress.get());
      if (marketHash.get().trim()) {
        await loadListings();
      }
      return walletAddress.get();
    } finally {
      isWalletConnecting.set(false);
    }
  }

  async function loadListings() {
    try {
      if (!marketHash.get().trim()) {
        throw new Error(t("marketHashRequired"));
      }
      isLoading.set(true);
      const result = await listAddressListings(
        app,
        marketHash.get(),
        walletAddress.get(),
      );
      listings.set(result.listings);
      totalOnChainListings.set(result.total);
      listingsTruncated.set(result.truncated);
      const currentListings = listings.get();
      const firstListing = currentListings[0];

      if (selectedListingId.get()) {
        const nextSelected = currentListings.find(
          (l) => l.id === selectedListingId.get(),
        );
        if (nextSelected) {
          selectListing(nextSelected);
        } else if (firstListing) {
          selectListing(firstListing);
        } else {
          selectedListingId.set("");
        }
      } else if (firstListing) {
        selectListing(firstListing);
      }

      persistConfig();
    } finally {
      isLoading.set(false);
    }
  }

  /**
   * Run a market write inside its framework operation: the operation owns
   * the busy flag AND the toast keys (the same keys the retired notify.guard
   * wrappers used — success toast on the given key, error toast mapped with
   * the errorKey fallback, failures swallowed). The chain lane itself is
   * toast-silent (raw invoke / invokeMultiple notify:'silent') so nothing
   * double-toasts.
   */
  async function runWrite(
    op: MarketWriteOperation,
    keys: { successKey?: string; errorKey: string },
    action: (address: string) => Promise<{ txid: string }>,
  ) {
    return op.run(async () => {
      const address = await app.chain.ensureWallet();
      const result = await action(address);
      await loadListings();
      return result;
    }, keys);
  }

  // Pre-check that the account is registered in AA core and owned by the seller
  // before the create write. createListing aborts "Account not found" on the
  // contract otherwise; surface a localized reason instead of a raw revert.
  async function assertCreatable(sellerAddress: string) {
    const id = accountIdHash.get().trim();
    const accountId = normalizeScriptHash(id);
    // Route the read through the framework passthrough. The Hash160 arg is kept
    // as a literal (not app.chain.arg.hash160) because `accountId` comes from
    // normalizeScriptHash — a validity-agnostic normalizer — and arg.hash160
    // throws on malformed input, which would change this pre-check's error path.
    const owner = await app.chain.readRaw(
      "getBackupOwner",
      [{ type: "Hash160", value: accountId }],
      { scriptHash: aaContractHash.get() || getDefaultAAContractHash() },
    );
    const ownerHash = parseHash160(owner);
    if (!ownerHash || /^0x0{40}$/i.test(ownerHash)) {
      throw new Error(t("accountNotRegistered"));
    }
    const sellerHash = sellerAddress.startsWith("N")
      ? addressToScriptHash(sellerAddress)
      : normalizeScriptHash(sellerAddress);
    if (
      ownerHash.replace(/^0x/i, "").toLowerCase() !==
      sellerHash.replace(/^0x/i, "").toLowerCase()
    ) {
      throw new Error(t("notAccountOwner"));
    }
  }

  async function submitCreateListing() {
    // No successKey: main.tsx composes the txid-suffixed success status line
    // itself, exactly as before.
    const result = await runWrite(
      createListingOp,
      { errorKey: "actionFailed" },
      async (address) => {
        await assertCreatable(address);
        return createAddressListing(app, marketHash.get(), address, {
          aaContractHash: aaContractHash.get(),
          accountIdHash: accountIdHash.get(),
          priceGas: priceGas.get(),
          title: listingTitle.get(),
          metadataUri: metadataUri.get(),
        });
      },
    );
    // Clear the form only when the write landed (a failed write kept the
    // fields before, and still does — the operation swallows the error after
    // toasting it).
    if (result) {
      accountIdHash.set("");
      priceGas.set("");
      listingTitle.set("");
      metadataUri.set("");
    }
    return result;
  }

  async function submitUpdatePrice() {
    if (!selectedListing.get()) return;
    return runWrite(
      updatePriceOp,
      { successKey: "updatePriceSuccess", errorKey: "actionFailed" },
      (address) =>
        updateAddressListingPrice(
          app,
          marketHash.get(),
          address,
          selectedListing.get()!.id,
          nextPriceGas.get(),
        ),
    );
  }

  async function submitCancelSelected() {
    if (!selectedListing.get()) return;
    return runWrite(
      cancelListingOp,
      { successKey: "cancelListingSuccess", errorKey: "actionFailed" },
      (address) =>
        cancelAddressListing(
          app,
          marketHash.get(),
          address,
          selectedListing.get()!.id,
        ),
    );
  }

  async function submitBuySelected() {
    if (!selectedListing.get()) return;
    return runWrite(
      buyListingOp,
      { successKey: "buyListingSuccess", errorKey: "actionFailed" },
      (address) =>
        buyAddressListing(
          app,
          marketHash.get(),
          address,
          selectedListing.get()!,
          { newBackupOwner: newBackupOwner.get() },
        ),
    );
  }

  async function submitRefundSelected() {
    if (!selectedListing.get()) return;
    return runWrite(
      refundPendingOp,
      { successKey: "refundPendingSuccess", errorKey: "actionFailed" },
      (address) =>
        refundPendingAddressPurchase(
          app,
          marketHash.get(),
          address,
          selectedListing.get()!.id,
        ),
    );
  }

  const loadAll = async () => {
    // Default the market hash to the canonical AAAddressMarket for the active
    // network (the app's own manifest/registry) so the board is ready to load
    // immediately. The input stays editable as an advanced override, and a
    // cached override still wins.
    marketHash.set(
      readStoredString(MARKET_HASH_STORAGE_KEY) || getDefaultMarketHash(),
    );
    aaContractHash.set(
      readStoredString(AA_HASH_STORAGE_KEY) || getDefaultAAContractHash(),
    );
    newBackupOwner.set(walletAddress.get());
    // Only auto-load the board when a wallet is already connected. Reading the
    // market needs a wallet provider; firing it with no session leaves the board
    // spinning forever (the read blocks on a provider that never arrives in a
    // wallet-less preview). With no session the board rests on a "connect to
    // load" state, and connectWallet() loads it the moment a wallet attaches.
    if (marketHash.get().trim() && walletAddress.get().trim()) {
      await loadListings().catch((e: unknown) => {
        console.warn(
          "[aa-market-hub] loadListings failed:",
          e instanceof Error ? e.message : String(e),
        );
      });
    }
  };

  const cleanup = () => {
    unsubMarket();
    unsubAA();
  };

  return {
    marketHash,
    aaContractHash,
    accountIdHash,
    priceGas,
    listingTitle,
    metadataUri,
    nextPriceGas,
    newBackupOwner,
    selectedListingId,
    listings,
    totalOnChainListings,
    listingsTruncated,
    isLoading,
    isSubmitting,
    isUpdatingPrice,
    isCancelling,
    isBuying,
    isRefunding,
    isWalletConnecting,
    walletAddress,
    selectedListing,
    selectedListingHasPendingRefund,
    canCreateListing,
    canManageSelectedListing,
    canBuySelectedListing,
    totalListingsDisplay,
    listingsTruncatedNotice,
    activeListingsDisplay,
    marketHashDisplay,
    walletDisplay,
    selectedListingDisplay,
    formatGasFractions,
    selectListing,
    connectWallet,
    loadListings,
    submitCreateListing,
    submitUpdatePrice,
    submitCancelSelected,
    submitBuySelected,
    submitRefundSelected,
    loadAll,
    cleanup,
  };
}

export type UseAAMarketHubReturn = ReturnType<typeof useAAMarketHub>;
