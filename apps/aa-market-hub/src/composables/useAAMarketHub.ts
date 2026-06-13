/**
 * useAAMarketHub -- Domain logic for AA Market Hub
 *
 * Uses createObservable instead of Vue ref/computed/watch.
 * Called once during setup, returns observables that React components subscribe to.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { ChainService, EventBus } from "@shared/services";
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
import { formatErrorMessage } from "@shared/utils/errorHandling";
import {
  addressToScriptHash,
  normalizeScriptHash,
  parseHash160,
} from "@shared/utils/neo";
import { readCachedJSON, writeCachedJSON } from "@shared/utils/runtime-cache";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { useWallet } from "@shared/utils/wallet-sdk";

const MARKET_HASH_STORAGE_KEY = "aa-market-hub:market-hash";
const AA_HASH_STORAGE_KEY = "aa-market-hub:aa-contract-hash";

export interface UseAAMarketHubOptions {
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useAAMarketHub({ chain, eventBus, t }: UseAAMarketHubOptions) {
  const wallet = useWallet() as WalletSDK;

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
  // Shared write flag (used by create) plus per-action flags so the four manage
  // buttons spin independently instead of all at once.
  const isSubmitting = createObservable(false);
  const isUpdatingPrice = createObservable(false);
  const isCancelling = createObservable(false);
  const isBuying = createObservable(false);
  const isRefunding = createObservable(false);
  const isWalletConnecting = createObservable(false);

  const walletAddress: Observable<string> = {
    get: () => chain.address.get() || "",
    set: () => {},
    subscribe: (fn) => chain.address.subscribe(fn),
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
    writeCachedJSON(MARKET_HASH_STORAGE_KEY, marketHash.get().trim());
    writeCachedJSON(AA_HASH_STORAGE_KEY, aaContractHash.get().trim());
  }

  function readCachedString(key: string): string {
    const cached = readCachedJSON<string>(key);
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
      await wallet.connect();
      newBackupOwner.set(walletAddress.get());
      eventBus.emit("wallet:connected", { address: walletAddress.get() });
      if (marketHash.get().trim()) {
        await loadListings();
      }
      return walletAddress.get();
    } catch (error: unknown) {
      eventBus.emit("wallet:error", {
        message: formatErrorMessage(error, t("connectFailed")),
      });
      throw error;
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
        wallet,
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
      eventBus.emit("listings:loaded", { count: currentListings.length });
    } catch (error: unknown) {
      eventBus.emit("listings:error", {
        message: formatErrorMessage(error, t("loadListingsFailed")),
      });
      throw error;
    } finally {
      isLoading.set(false);
    }
  }

  async function runWriteAction(
    action: (address: string) => Promise<{ txid: string }>,
    successMessage: string,
    actionFlag?: ReturnType<typeof createObservable<boolean>>,
  ) {
    try {
      isSubmitting.set(true);
      actionFlag?.set(true);
      const address = await chain.ensureWallet();
      const result = await action(address);
      eventBus.emit("action:success", {
        message: successMessage,
        txid: result.txid,
      });
      await loadListings();
      return result;
    } catch (error: unknown) {
      eventBus.emit("action:error", {
        message: formatErrorMessage(error, t("actionFailed")),
      });
      throw error;
    } finally {
      isSubmitting.set(false);
      actionFlag?.set(false);
    }
  }

  // Pre-check that the account is registered in AA core and owned by the seller
  // before the create write. createListing aborts "Account not found" on the
  // contract otherwise; surface a localized reason instead of a raw revert.
  async function assertCreatable(sellerAddress: string) {
    const id = accountIdHash.get().trim();
    const accountId = normalizeScriptHash(id);
    const owner = await chain.read(
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
    const result = await runWriteAction(async (address) => {
      await assertCreatable(address);
      return createAddressListing(wallet, marketHash.get(), address, {
        aaContractHash: aaContractHash.get(),
        accountIdHash: accountIdHash.get(),
        priceGas: priceGas.get(),
        title: listingTitle.get(),
        metadataUri: metadataUri.get(),
      });
    }, t("createListingSuccess"));
    accountIdHash.set("");
    priceGas.set("");
    listingTitle.set("");
    metadataUri.set("");
    return result;
  }

  async function submitUpdatePrice() {
    if (!selectedListing.get()) return;
    return runWriteAction(
      (address) =>
        updateAddressListingPrice(
          wallet,
          marketHash.get(),
          address,
          selectedListing.get()!.id,
          nextPriceGas.get(),
        ),
      t("updatePriceSuccess"),
      isUpdatingPrice,
    );
  }

  async function submitCancelSelected() {
    if (!selectedListing.get()) return;
    return runWriteAction(
      (address) =>
        cancelAddressListing(
          wallet,
          marketHash.get(),
          address,
          selectedListing.get()!.id,
        ),
      t("cancelListingSuccess"),
      isCancelling,
    );
  }

  async function submitBuySelected() {
    if (!selectedListing.get()) return;
    return runWriteAction(
      (address) =>
        buyAddressListing(
          wallet,
          marketHash.get(),
          address,
          selectedListing.get()!,
          { newBackupOwner: newBackupOwner.get() },
        ),
      t("buyListingSuccess"),
      isBuying,
    );
  }

  async function submitRefundSelected() {
    if (!selectedListing.get()) return;
    return runWriteAction(
      (address) =>
        refundPendingAddressPurchase(
          wallet,
          marketHash.get(),
          address,
          selectedListing.get()!.id,
        ),
      t("refundPendingSuccess"),
      isRefunding,
    );
  }

  const loadAll = async () => {
    // Default the market hash to the canonical AAAddressMarket for the active
    // network (the app's own manifest/registry) so the board loads on first run
    // instead of showing "enter a market hash". The input stays editable as an
    // advanced override, and a cached override still wins.
    marketHash.set(
      readCachedString(MARKET_HASH_STORAGE_KEY) || getDefaultMarketHash(),
    );
    aaContractHash.set(
      readCachedString(AA_HASH_STORAGE_KEY) || getDefaultAAContractHash(),
    );
    newBackupOwner.set(walletAddress.get());
    if (marketHash.get().trim()) {
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
