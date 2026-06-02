/**
 * AA Market Hub — React Entry Point
 *
 * Uses the React defineMiniApp runtime with createObservable state.
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

  setup(ctx) {
    const hub = useAAMarketHub({
      chain: ctx.services.chain,
      eventBus: ctx.services.events,
      t: ctx.t,
    });
    const toActionString = (value: unknown) =>
      value === undefined || value === null ? "" : String(value);

    ctx.registerAction("connectWallet", async () => {
      const addr = await ctx.services.notify.guard(
        () => hub.connectWallet(),
        undefined,
        "connectFailed",
      );
      if (addr)
        ctx.setStatus(`${ctx.t("walletConnected")}: ${addr}`, "success");
    });

    ctx.registerAction("loadListings", async (marketHashInput: unknown) => {
      hub.marketHash.set(String(marketHashInput));
      await ctx.services.notify.guard(
        () => hub.loadListings(),
        "marketLoaded",
        "loadListingsFailed",
      );
    });

    ctx.registerAction("selectListing", async (listingId: unknown) => {
      const listing = hub.listings.get().find((l) => l.id === String(listingId));
      if (listing) hub.selectListing(listing);
    });

    ctx.registerAction("createListing", async (...args: unknown[]) => {
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
      const result = await ctx.services.notify.guard(
        () => hub.submitCreateListing(),
        undefined,
        "actionFailed",
      );
      if (result)
        ctx.setStatus(
          `${ctx.t("createListingSuccess")}${result?.txid ? `: ${result.txid}` : ""}`,
          "success",
        );
      return result;
    });

    ctx.registerAction("updatePrice", async (nextPriceGas: unknown) => {
      hub.nextPriceGas.set(String(nextPriceGas));
      await ctx.services.notify.guard(
        () => hub.submitUpdatePrice(),
        "updatePriceSuccess",
        "actionFailed",
      );
    });

    ctx.registerAction("cancelSelected", () =>
      ctx.services.notify.guard(
        () => hub.submitCancelSelected(),
        "cancelListingSuccess",
        "actionFailed",
      ),
    );

    ctx.registerAction("buySelected", async (newBackupOwner: unknown) => {
      hub.newBackupOwner.set(String(newBackupOwner));
      await ctx.services.notify.guard(
        () => hub.submitBuySelected(),
        "buyListingSuccess",
        "actionFailed",
      );
    });

    ctx.registerAction("refundSelected", () =>
      ctx.services.notify.guard(
        () => hub.submitRefundSelected(),
        "refundPendingSuccess",
        "actionFailed",
      ),
    );

    return {
      state: {
        listings: hub.listings,
        isLoading: hub.isLoading,
        isSubmitting: hub.isSubmitting,
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
