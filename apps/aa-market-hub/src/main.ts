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
      try {
        const addr = await hub.connectWallet();
        ctx.setStatus(`${ctx.t("walletConnected")}: ${addr}`, "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("connectFailed"), "error");
      }
    });

    ctx.registerAction("loadListings", async (marketHashInput: string) => {
      try {
        hub.marketHash.value = marketHashInput;
        await hub.loadListings();
        ctx.setStatus(ctx.t("marketLoaded"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("loadListingsFailed"), "error");
      }
    });

    ctx.registerAction("selectListing", (listingId: string) => {
      const listing = hub.listings.value.find((l) => l.id === listingId);
      if (listing) hub.selectListing(listing);
    });

    ctx.registerAction("createListing", async (aaContractHash: string, accountIdHash: string, priceGas: string, title: string, metadataUri: string) => {
      try {
        hub.aaContractHash.value = aaContractHash;
        hub.accountIdHash.value = accountIdHash;
        hub.priceGas.value = priceGas;
        hub.listingTitle.value = title;
        hub.metadataUri.value = metadataUri;
        const result = await hub.submitCreateListing();
        ctx.setStatus(`${ctx.t("createListingSuccess")}${result?.txid ? `: ${result.txid}` : ""}`, "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("actionFailed"), "error");
      }
    });

    ctx.registerAction("updatePrice", async (nextPriceGas: string) => {
      try {
        hub.nextPriceGas.value = nextPriceGas;
        await hub.submitUpdatePrice();
        ctx.setStatus(ctx.t("updatePriceSuccess"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("actionFailed"), "error");
      }
    });

    ctx.registerAction("cancelSelected", async () => {
      try {
        await hub.submitCancelSelected();
        ctx.setStatus(ctx.t("cancelListingSuccess"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("actionFailed"), "error");
      }
    });

    ctx.registerAction("buySelected", async (newBackupOwner: string) => {
      try {
        hub.newBackupOwner.value = newBackupOwner;
        await hub.submitBuySelected();
        ctx.setStatus(ctx.t("buyListingSuccess"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("actionFailed"), "error");
      }
    });

    ctx.registerAction("refundSelected", async () => {
      try {
        await hub.submitRefundSelected();
        ctx.setStatus(ctx.t("refundPendingSuccess"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("actionFailed"), "error");
      }
    });

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
