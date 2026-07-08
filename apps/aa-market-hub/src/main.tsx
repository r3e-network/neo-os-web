/**
 * AA Market Hub — React Entry Point
 *
 * Uses the React defineMiniApp runtime with createObservable state.
 * Toasts ride the framework: read-lane actions wrap in app.notify.guard and
 * every write toasts from inside its app.operations operation (same keys the
 * retired raw notify-service guard wrappers used).
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useAAMarketHub } from "./composables/useAAMarketHub";

defineMiniApp({
  appId: "miniapp-aa-market-hub",
  playArea: PlayArea,
  manifest,
  messages,
  // Pre-framework config lived at "aa-market-hub:<key>" — pin the prefix so
  // app.storage.local resolves the exact same localStorage entries.
  storagePrefix: "aa-market-hub:",

  setup(ctx) {
    const app = ctx.framework;
    const hub = useAAMarketHub({ app, t: ctx.t });
    const toActionString = (value: unknown) =>
      value === undefined || value === null ? "" : String(value);

    app.actions.register("connectWallet", async () => {
      const addr = await app.notify.guard(() => hub.connectWallet(), {
        errorKey: "connectFailed",
      });
      if (addr)
        ctx.setStatus(`${ctx.t("walletConnected")}: ${addr}`, "success");
    });

    app.actions.register("loadListings", async (marketHashInput: unknown) => {
      hub.marketHash.set(String(marketHashInput));
      await app.notify.guard(() => hub.loadListings(), {
        successKey: "marketLoaded",
        errorKey: "loadListingsFailed",
      });
    });

    app.actions.register("selectListing", async (listingId: unknown) => {
      const listing = hub.listings.get().find((l) => l.id === String(listingId));
      if (listing) hub.selectListing(listing);
    });

    app.actions.register("createListing", async (...args: unknown[]) => {
      const [
        marketHashInput,
        aaContractHash,
        accountIdHash,
        priceGas,
        title,
        metadataUri,
      ] =
        args.length >= 6
          ? args
          : [undefined, args[0], args[1], args[2], args[3], args[4]];
      if (marketHashInput !== undefined) {
        hub.marketHash.set(toActionString(marketHashInput));
      }
      hub.aaContractHash.set(toActionString(aaContractHash));
      hub.accountIdHash.set(toActionString(accountIdHash));
      hub.priceGas.set(toActionString(priceGas));
      hub.listingTitle.set(toActionString(title));
      hub.metadataUri.set(toActionString(metadataUri));
      // The create operation toasts failures ("actionFailed" fallback) and
      // resolves undefined for them; only a landed write reaches setStatus.
      const result = await hub.submitCreateListing();
      if (result)
        ctx.setStatus(
          `${ctx.t("createListingSuccess")}${result?.txid ? `: ${result.txid}` : ""}`,
          "success",
        );
      return result;
    });

    app.actions.register("updatePrice", async (nextPriceGas: unknown) => {
      hub.nextPriceGas.set(String(nextPriceGas));
      await hub.submitUpdatePrice();
    });

    app.actions.register("cancelSelected", () => hub.submitCancelSelected());

    app.actions.register("buySelected", async (newBackupOwner: unknown) => {
      hub.newBackupOwner.set(String(newBackupOwner));
      await hub.submitBuySelected();
    });

    app.actions.register("refundSelected", () => hub.submitRefundSelected());

    return {
      state: {
        listings: hub.listings,
        isLoading: hub.isLoading,
        isSubmitting: hub.isSubmitting,
        isUpdatingPrice: hub.isUpdatingPrice,
        isCancelling: hub.isCancelling,
        isBuying: hub.isBuying,
        isRefunding: hub.isRefunding,
        isWalletConnecting: hub.isWalletConnecting,
        marketHash: hub.marketHash,
        aaContractHash: hub.aaContractHash,
        accountIdHash: hub.accountIdHash,
        priceGas: hub.priceGas,
        listingTitle: hub.listingTitle,
        metadataUri: hub.metadataUri,
        walletAddress: hub.walletAddress,
        selectedListingId: hub.selectedListingId,
        selectedListing: hub.selectedListing,
        selectedListingHasPendingRefund: hub.selectedListingHasPendingRefund,
        canCreateListing: hub.canCreateListing,
        canManageSelectedListing: hub.canManageSelectedListing,
        canBuySelectedListing: hub.canBuySelectedListing,
        totalListingsDisplay: hub.totalListingsDisplay,
        listingsTruncatedNotice: hub.listingsTruncatedNotice,
        activeListingsDisplay: hub.activeListingsDisplay,
        marketHashDisplay: hub.marketHashDisplay,
        walletDisplay: hub.walletDisplay,
        selectedListingDisplay: hub.selectedListingDisplay,
      },
      loadData: hub.loadAll,
      cleanup: () => {
        hub.cleanup();
      },
    };
  },
});
