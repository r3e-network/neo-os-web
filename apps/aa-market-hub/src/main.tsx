import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import {
  useAAMarketHub,
  type AAMarketActionResult,
  type MarketMode,
} from "./composables/useAAMarketHub";

defineMiniApp({
  appId: "miniapp-aa-market-hub",
  playArea: PlayArea,
  manifest,
  messages,
  storagePrefix: "aa-market-hub:",

  setup(ctx) {
    const hub = useAAMarketHub({ app: ctx.framework, t: ctx.t });

    const showOutcome = (result: AAMarketActionResult | null | undefined) => {
      if (!result) return result;
      if (result.status === "confirmed") {
        ctx.setStatus(ctx.t("transactionConfirmed"), "success");
      } else if (result.status === "fault") {
        ctx.setStatus(ctx.t("transactionFaulted"), "error");
      } else if (result.status === "confirmation-required") {
        ctx.setStatus(ctx.t("confirmCancellation"), "warning");
      } else {
        ctx.setStatus(ctx.t("transactionPending"), "warning");
      }
      return result;
    };

    const runAction = async <T,>(action: () => Promise<T>): Promise<T | null> => {
      try {
        return await action();
      } catch (error) {
        hub.reportFailure(error);
        ctx.setStatus(hub.lastError.get() || ctx.t("actionFailed"), "error");
        return null;
      }
    };

    ctx.framework.actions.register("setMode", async (value: unknown) => {
      hub.mode.set(value === "sell" ? "sell" : "explore");
    });

    ctx.framework.actions.register("connectWallet", async () => {
      const address = await runAction(() => hub.connectWallet());
      if (address) ctx.setStatus(ctx.t("walletConnected"), "success");
      return address;
    });

    ctx.framework.actions.register("loadListings", async () => {
      const loaded = await runAction(async () => {
        await hub.loadListings();
        return true;
      });
      if (loaded) ctx.setStatus(ctx.t("marketLoaded"), "success");
    });

    ctx.framework.actions.register("selectListing", async (listingId: unknown) => {
      const listing = hub.listings.get().find((item) => item.id === String(listingId));
      if (listing) hub.selectListing(listing);
    });

    ctx.framework.actions.register(
      "createListing",
      async (accountId: unknown, price: unknown, title: unknown, metadata: unknown) => {
        hub.accountIdHash.set(String(accountId ?? ""));
        hub.priceGas.set(String(price ?? ""));
        hub.listingTitle.set(String(title ?? ""));
        hub.metadataUri.set(String(metadata ?? ""));
        return runAction(async () => showOutcome(await hub.submitCreateListing()));
      },
    );

    ctx.framework.actions.register("updatePrice", async (price: unknown) => {
      hub.nextPriceGas.set(String(price ?? ""));
      return runAction(async () => showOutcome(await hub.submitUpdatePrice()));
    });

    ctx.framework.actions.register("cancelSelected", async () =>
      runAction(async () => showOutcome(await hub.submitCancelSelected())));

    ctx.framework.actions.register("buySelected", async (backupOwner: unknown) => {
      hub.newBackupOwner.set(String(backupOwner ?? ""));
      return runAction(async () => showOutcome(await hub.submitBuySelected()));
    });

    ctx.framework.actions.register("refundSelected", async () =>
      runAction(async () => showOutcome(await hub.submitRefundSelected())));

    ctx.framework.actions.register("recoverPending", async () =>
      runAction(async () => showOutcome(await hub.recoverPendingOperation())));

    return {
      state: {
        mode: hub.mode,
        network: hub.network,
        marketHash: hub.marketHash,
        aaContractHash: hub.aaContractHash,
        accountIdHash: hub.accountIdHash,
        priceGas: hub.priceGas,
        listingTitle: hub.listingTitle,
        metadataUri: hub.metadataUri,
        nextPriceGas: hub.nextPriceGas,
        newBackupOwner: hub.newBackupOwner,
        listings: hub.listings,
        totalOnChainListings: hub.totalOnChainListings,
        selectedListingId: hub.selectedListingId,
        selectedListing: hub.selectedListing,
        walletAddress: hub.walletAddress,
        isLoading: hub.isLoading,
        isWalletConnecting: hub.isWalletConnecting,
        isSubmitting: hub.isSubmitting,
        isRecovering: hub.isRecovering,
        activeAction: hub.activeAction,
        dataSource: hub.dataSource,
        failedListingReads: hub.failedListingReads,
        lastError: hub.lastError,
        lastSuccess: hub.lastSuccess,
        transactionNotice: hub.transactionNotice,
        pendingOperation: hub.pendingOperation,
        recoveryStorageHealthy: hub.recoveryStorageHealthy,
        cancelConfirmationId: hub.cancelConfirmationId,
        canCreateListing: hub.canCreateListing,
        canManageSelectedListing: hub.canManageSelectedListing,
        canBuySelectedListing: hub.canBuySelectedListing,
        selectedListingHasPendingRefund: hub.selectedListingHasPendingRefund,
        totalListingsDisplay: hub.totalListingsDisplay,
        activeListingsDisplay: hub.activeListingsDisplay,
        marketHashDisplay: hub.marketHashDisplay,
        walletDisplay: hub.walletDisplay,
        selectedListingDisplay: hub.selectedListingDisplay,
        listingsTruncatedNotice: hub.listingsTruncatedNotice,
      },
      loadData: hub.loadAll,
      cleanup: hub.cleanup,
    };
  },
});

export type { MarketMode };
