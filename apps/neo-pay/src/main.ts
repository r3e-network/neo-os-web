/**
 * Neo Pay — Entry Point (New Pattern)
 *
 * Uses defineMiniApp() to wire PlayArea, manifest, messages, and domain logic.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useNeoPayApp } from "./composables/useNeoPayApp";

defineMiniApp({
  appId: "miniapp-neo-pay",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-neo-pay", {
      t: ctx.t as (key: string) => string,
    });

    const pay = useNeoPayApp({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    ctx.registerAction("refreshStreams", async () => {
      try {
        await pay.refreshStreams();
      } catch (e: unknown) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("contractMissing"), "error");
      }
    });

    ctx.registerAction("connectWallet", async () => {
      try {
        await pay.connectWallet();
        ctx.setStatus("Wallet connected", "success");
      } catch (e: unknown) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("walletNotConnected"), "error");
      }
    });

    ctx.registerAction("createVault", async (formData: { name: string; beneficiary: string; asset: string; total: string; rate: string; intervalDays: string; notes: string }) => {
      try {
        await pay.handleCreateVault(formData);
        ctx.setStatus(ctx.t("vaultCreated"), "success");
      } catch (e: unknown) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("contractMissing"), "error");
      }
    });

    ctx.registerAction("claimStream", async (stream: { id: string; creator: string; beneficiary: string; asset: string; assetSymbol: string; totalAmount: bigint; releasedAmount: bigint; remainingAmount: bigint; rateAmount: bigint; intervalSeconds: bigint; intervalDays: number; status: string; claimable: bigint; title: string; notes: string }) => {
      try {
        await pay.claimStream(stream as any);
        ctx.setStatus("Stream claimed", "success");
      } catch (e: unknown) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("contractMissing"), "error");
      }
    });

    ctx.registerAction("cancelStream", async (stream: { id: string; creator: string; beneficiary: string; asset: string; assetSymbol: string; totalAmount: bigint; releasedAmount: bigint; remainingAmount: bigint; rateAmount: bigint; intervalSeconds: bigint; intervalDays: number; status: string; claimable: bigint; title: string; notes: string }) => {
      try {
        await pay.cancelStream(stream as any);
        ctx.setStatus("Stream cancelled", "success");
      } catch (e: unknown) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("contractMissing"), "error");
      }
    });

    return {
      state: {
        address: pay.address,
        createdStreams: pay.createdStreams,
        beneficiaryStreams: pay.beneficiaryStreams,
        isLoading: pay.isLoading,
        isRefreshing: pay.isRefreshing,
        claimingId: pay.claimingId,
        cancellingId: pay.cancellingId,
        activeCount: pay.activeCount,
        createdStreamCount: pay.createdStreamCount,
        beneficiaryStreamCount: pay.beneficiaryStreamCount,
        totalStreamCount: pay.totalStreamCount,
      },
      loadData: pay.loadAll,
      cleanup: () => platformServices.destroy(),
    };
  },
});
