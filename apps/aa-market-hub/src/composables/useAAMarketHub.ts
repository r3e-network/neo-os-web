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
  listAddressListings,
  refundPendingAddressPurchase,
  type MarketListing,
  updateAddressListingPrice,
} from "../utils/aa-market";
import { formatErrorMessage } from "@shared/utils/errorHandling";
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
  const isLoading = createObservable(false);
  const isSubmitting = createObservable(false);
  const isWalletConnecting = createObservable(false);

  const walletAddress: Observable<string> = {
    get: () => wallet.address.value || "",
    set: () => {},
    subscribe: () => () => {},
  };

  const selectedListing: Observable<MarketListing | null> = {
    get: () => listings.get().find((l) => l.id === selectedListingId.get()) ?? null,
    set: () => {},
    subscribe: (fn) => {
      const u1 = listings.subscribe(fn);
      const u2 = selectedListingId.subscribe(fn);
      return () => { u1(); u2(); };
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
    get: () => Boolean(marketHash.get().trim() && aaContractHash.get().trim() && accountIdHash.get().trim() && priceGas.get().trim()),
    set: () => {},
    subscribe: (fn) => {
      const u1 = marketHash.subscribe(fn);
      const u2 = aaContractHash.subscribe(fn);
      const u3 = accountIdHash.subscribe(fn);
      const u4 = priceGas.subscribe(fn);
      return () => { u1(); u2(); u3(); u4(); };
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
    get: () => listings.get().length,
    set: () => {},
    subscribe: (fn) => listings.subscribe(fn),
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
      eventBus.emit("wallet:error", { message: formatErrorMessage(error, t("connectFailed")) });
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
      listings.set(await listAddressListings(wallet, marketHash.get(), walletAddress.get()));

      if (selectedListingId.get()) {
        const nextSelected = listings.get().find((l) => l.id === selectedListingId.get());
        if (nextSelected) {
          selectListing(nextSelected);
        } else if (listings.get()[0]) {
          selectListing(listings.get()[0]);
        } else {
          selectedListingId.set("");
        }
      } else if (listings.get()[0]) {
        selectListing(listings.get()[0]);
      }

      persistConfig();
      eventBus.emit("listings:loaded", { count: listings.get().length });
    } catch (error: unknown) {
      eventBus.emit("listings:error", { message: formatErrorMessage(error, t("loadListingsFailed")) });
      throw error;
    } finally {
      isLoading.set(false);
    }
  }

  async function runWriteAction(action: () => Promise<{ txid: string }>, successMessage: string) {
    try {
      isSubmitting.set(true);
      const result = await action();
      eventBus.emit("action:success", { message: successMessage, txid: result.txid });
      await loadListings();
      return result;
    } catch (error: unknown) {
      eventBus.emit("action:error", { message: formatErrorMessage(error, t("actionFailed")) });
      throw error;
    } finally {
      isSubmitting.set(false);
    }
  }

  async function submitCreateListing() {
    const result = await runWriteAction(
      () => createAddressListing(wallet, marketHash.get(), {
        aaContractHash: aaContractHash.get(),
        accountIdHash: accountIdHash.get(),
        priceGas: priceGas.get(),
        title: listingTitle.get(),
        metadataUri: metadataUri.get(),
      }),
      t("createListingSuccess"),
    );
    accountIdHash.set("");
    priceGas.set("");
    listingTitle.set("");
    metadataUri.set("");
    return result;
  }

  async function submitUpdatePrice() {
    if (!selectedListing.get()) return;
    return runWriteAction(
      () => updateAddressListingPrice(wallet, marketHash.get(), selectedListing.get()!.id, nextPriceGas.get()),
      t("updatePriceSuccess"),
    );
  }

  async function submitCancelSelected() {
    if (!selectedListing.get()) return;
    return runWriteAction(
      () => cancelAddressListing(wallet, marketHash.get(), selectedListing.get()!.id),
      t("cancelListingSuccess"),
    );
  }

  async function submitBuySelected() {
    if (!selectedListing.get()) return;
    return runWriteAction(
      () => buyAddressListing(wallet, marketHash.get(), selectedListing.get()!.id, { newBackupOwner: newBackupOwner.get() }),
      t("buyListingSuccess"),
    );
  }

  async function submitRefundSelected() {
    if (!selectedListing.get()) return;
    return runWriteAction(
      () => refundPendingAddressPurchase(wallet, marketHash.get(), selectedListing.get()!.id),
      t("refundPendingSuccess"),
    );
  }

  const loadAll = async () => {
    marketHash.set(readCachedString(MARKET_HASH_STORAGE_KEY));
    aaContractHash.set(readCachedString(AA_HASH_STORAGE_KEY) || getDefaultAAContractHash());
    newBackupOwner.set(walletAddress.get());
    if (marketHash.get().trim()) {
      await loadListings().catch((e: unknown) => {
        console.warn("[aa-market-hub] loadListings failed:", e instanceof Error ? e.message : String(e));
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
    isLoading,
    isSubmitting,
    isWalletConnecting,
    walletAddress,
    selectedListing,
    selectedListingHasPendingRefund,
    canCreateListing,
    canManageSelectedListing,
    canBuySelectedListing,
    totalListingsDisplay,
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
