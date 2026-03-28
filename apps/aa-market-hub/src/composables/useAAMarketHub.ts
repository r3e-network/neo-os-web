/**
 * useAAMarketHub — Domain logic for AA Market Hub
 *
 * Encapsulates all AA address marketplace logic: listing, buying, selling,
 * cancelling, and refunding. Receives ChainService + EventBus from
 * PlatformServices.
 */

import { ref, computed, watch, onUnmounted } from "vue";
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

  // -- Form state --
  const marketHash = ref("");
  const aaContractHash = ref(getDefaultAAContractHash());
  const accountIdHash = ref("");
  const priceGas = ref("");
  const listingTitle = ref("");
  const metadataUri = ref("");
  const nextPriceGas = ref("");
  const newBackupOwner = ref("");
  const selectedListingId = ref("");
  const listings = ref<MarketListing[]>([]);
  const isLoading = ref(false);
  const isSubmitting = ref(false);
  const isWalletConnecting = ref(false);

  const walletAddress = computed(() => wallet.address.value || "");
  const selectedListing = computed(() => listings.value.find((l) => l.id === selectedListingId.value) ?? null);
  const activeListings = computed(() => listings.value.filter((l) => l.status === "active").length);
  const selectedListingHasPendingRefund = computed(() => {
    const pending = selectedListing.value?.myPendingPayment || "0";
    return BigInt(pending) > 0n;
  });
  const canCreateListing = computed(() =>
    Boolean(marketHash.value.trim() && aaContractHash.value.trim() && accountIdHash.value.trim() && priceGas.value.trim()));
  const canManageSelectedListing = computed(() =>
    Boolean(selectedListing.value && selectedListing.value.status === "active" && selectedListing.value.isMine));
  const canBuySelectedListing = computed(() =>
    Boolean(selectedListing.value && selectedListing.value.status === "active" && !selectedListing.value.isMine));

  // -- Display values --
  const totalListingsDisplay = computed(() => listings.value.length);
  const activeListingsDisplay = computed(() => activeListings.value);
  const marketHashDisplay = computed(() => {
    const hash = marketHash.value || "";
    if (!hash || hash.length <= 21) return hash || t("notAvailable");
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  });
  const walletDisplay = computed(() => {
    const addr = walletAddress.value;
    if (!addr || addr.length <= 21) return addr || t("notAvailable");
    return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
  });
  const selectedListingDisplay = computed(() =>
    selectedListing.value ? `#${selectedListing.value.id}` : t("notAvailable"));

  // -- Persistence --
  function persistConfig() {
    writeCachedJSON(MARKET_HASH_STORAGE_KEY, marketHash.value.trim());
    writeCachedJSON(AA_HASH_STORAGE_KEY, aaContractHash.value.trim());
  }

  function readCachedString(key: string): string {
    const cached = readCachedJSON<string>(key);
    return typeof cached === "string" ? cached : "";
  }

  // -- Helpers --
  function hasPendingPayment(listing: MarketListing) {
    return BigInt(listing.myPendingPayment || "0") > 0n;
  }

  function selectListing(listing: MarketListing) {
    selectedListingId.value = listing.id;
    nextPriceGas.value = listing.priceGas;
    newBackupOwner.value = walletAddress.value;
  }

  // -- Actions --
  async function connectWallet() {
    try {
      isWalletConnecting.value = true;
      await wallet.connect();
      newBackupOwner.value = walletAddress.value;
      eventBus.emit("wallet:connected", { address: walletAddress.value });
      if (marketHash.value.trim()) {
        await loadListings();
      }
      return walletAddress.value;
    } catch (error: unknown) {
      eventBus.emit("wallet:error", { message: formatErrorMessage(error, t("connectFailed")) });
      throw error;
    } finally {
      isWalletConnecting.value = false;
    }
  }

  async function loadListings() {
    try {
      if (!marketHash.value.trim()) {
        throw new Error(t("marketHashRequired"));
      }
      isLoading.value = true;
      listings.value = await listAddressListings(wallet, marketHash.value, walletAddress.value);

      if (selectedListingId.value) {
        const nextSelected = listings.value.find((l) => l.id === selectedListingId.value);
        if (nextSelected) {
          selectListing(nextSelected);
        } else if (listings.value[0]) {
          selectListing(listings.value[0]);
        } else {
          selectedListingId.value = "";
        }
      } else if (listings.value[0]) {
        selectListing(listings.value[0]);
      }

      persistConfig();
      eventBus.emit("listings:loaded", { count: listings.value.length });
    } catch (error: unknown) {
      eventBus.emit("listings:error", { message: formatErrorMessage(error, t("loadListingsFailed")) });
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  async function runWriteAction(action: () => Promise<{ txid: string }>, successMessage: string) {
    try {
      isSubmitting.value = true;
      const result = await action();
      eventBus.emit("action:success", { message: successMessage, txid: result.txid });
      await loadListings();
      return result;
    } catch (error: unknown) {
      eventBus.emit("action:error", { message: formatErrorMessage(error, t("actionFailed")) });
      throw error;
    } finally {
      isSubmitting.value = false;
    }
  }

  async function submitCreateListing() {
    const result = await runWriteAction(
      () => createAddressListing(wallet, marketHash.value, {
        aaContractHash: aaContractHash.value,
        accountIdHash: accountIdHash.value,
        priceGas: priceGas.value,
        title: listingTitle.value,
        metadataUri: metadataUri.value,
      }),
      t("createListingSuccess"),
    );
    accountIdHash.value = "";
    priceGas.value = "";
    listingTitle.value = "";
    metadataUri.value = "";
    return result;
  }

  async function submitUpdatePrice() {
    if (!selectedListing.value) return;
    return runWriteAction(
      () => updateAddressListingPrice(wallet, marketHash.value, selectedListing.value!.id, nextPriceGas.value),
      t("updatePriceSuccess"),
    );
  }

  async function submitCancelSelected() {
    if (!selectedListing.value) return;
    return runWriteAction(
      () => cancelAddressListing(wallet, marketHash.value, selectedListing.value!.id),
      t("cancelListingSuccess"),
    );
  }

  async function submitBuySelected() {
    if (!selectedListing.value) return;
    return runWriteAction(
      () => buyAddressListing(wallet, marketHash.value, selectedListing.value!.id, { newBackupOwner: newBackupOwner.value }),
      t("buyListingSuccess"),
    );
  }

  async function submitRefundSelected() {
    if (!selectedListing.value) return;
    return runWriteAction(
      () => refundPendingAddressPurchase(wallet, marketHash.value, selectedListing.value!.id),
      t("refundPendingSuccess"),
    );
  }

  const stopConfigWatch = watch([marketHash, aaContractHash], persistConfig);

  const loadAll = async () => {
    marketHash.value = readCachedString(MARKET_HASH_STORAGE_KEY);
    aaContractHash.value = readCachedString(AA_HASH_STORAGE_KEY) || getDefaultAAContractHash();
    newBackupOwner.value = walletAddress.value;
    if (marketHash.value.trim()) {
      await loadListings().catch((e: unknown) => {
        console.warn("[aa-market-hub] loadListings failed:", e instanceof Error ? e.message : String(e));
      });
    }
  };

  const cleanup = () => {
    stopConfigWatch();
  };

  return {
    // -- Form state --
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

    // -- Computed --
    walletAddress,
    selectedListing,
    activeListings,
    selectedListingHasPendingRefund,
    canCreateListing,
    canManageSelectedListing,
    canBuySelectedListing,

    // -- Display values --
    totalListingsDisplay,
    activeListingsDisplay,
    marketHashDisplay,
    walletDisplay,
    selectedListingDisplay,

    // -- Helpers --
    hasPendingPayment,
    selectListing,
    formatGasFractions,

    // -- Actions --
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
