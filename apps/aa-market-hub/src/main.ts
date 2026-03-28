/**
 * AA Market Hub — Entry Point (New Pattern)
 *
 * Uses defineMiniApp() to wire PlayArea, manifest, messages, and domain logic.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useAAMarketHub } from "./composables/useAAMarketHub";

defineMiniApp({
  appId: "miniapp-aa-market-hub",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-aa-market-hub", {
      t: ctx.t as (key: string) => string,
    });

    const hub = useAAMarketHub({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    ctx.registerAction("connectWallet", async () => {
      const addr = await platformServices.notify.guard(() => hub.connectWallet(), undefined, "connectFailed");
      if (addr) ctx.setStatus(`${ctx.t("walletConnected")}: ${addr}`, "success");
    });

    ctx.registerAction("loadListings", async (marketHashInput: string) => {
      hub.marketHash.value = marketHashInput;
      await platformServices.notify.guard(() => hub.loadListings(), "marketLoaded", "loadListingsFailed");
    });

    ctx.registerAction("selectListing", (listingId: string) => {
      const listing = hub.listings.value.find((l) => l.id === listingId);
      if (listing) hub.selectListing(listing);
    });

    ctx.registerAction("createListing", async (aaContractHash: string, accountIdHash: string, priceGas: string, title: string, metadataUri: string) => {
      hub.aaContractHash.value = aaContractHash;
      hub.accountIdHash.value = accountIdHash;
      hub.priceGas.value = priceGas;
      hub.listingTitle.value = title;
      hub.metadataUri.value = metadataUri;
      const result = await platformServices.notify.guard(() => hub.submitCreateListing(), undefined, "actionFailed");
      if (result) ctx.setStatus(`${ctx.t("createListingSuccess")}${result?.txid ? `: ${result.txid}` : ""}`, "success");
    });

    ctx.registerAction("updatePrice", async (nextPriceGas: string) => {
      hub.nextPriceGas.value = nextPriceGas;
      await platformServices.notify.guard(() => hub.submitUpdatePrice(), "updatePriceSuccess", "actionFailed");
    });

    ctx.registerAction("cancelSelected", () =>
      platformServices.notify.guard(() => hub.submitCancelSelected(), "cancelListingSuccess", "actionFailed"),
    );

    ctx.registerAction("buySelected", async (newBackupOwner: string) => {
      hub.newBackupOwner.value = newBackupOwner;
      await platformServices.notify.guard(() => hub.submitBuySelected(), "buyListingSuccess", "actionFailed");
    });

    ctx.registerAction("refundSelected", () =>
      platformServices.notify.guard(() => hub.submitRefundSelected(), "refundPendingSuccess", "actionFailed"),
    );

    return {
      state: {
        listings: hub.listings,
        isLoading: hub.isLoading,
        isSubmitting: hub.isSubmitting,
        isWalletConnecting: hub.isWalletConnecting,
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
      cleanup: () => { hub.cleanup(); platformServices.destroy(); },
    };
  },
});
