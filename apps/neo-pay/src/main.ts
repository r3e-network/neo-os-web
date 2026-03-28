/**
 * Neo Pay — Entry Point (New Pattern)
 *
 * Uses defineMiniApp() to wire PlayArea, manifest, messages, and domain logic.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
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
    const platformServices = ctx.services;

    const pay = useNeoPayApp({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    const { notify } = platformServices;

    ctx.registerAction("refreshStreams", async () => {
      await notify.guard(
        () => pay.refreshStreams(),
        undefined,
        "contractMissing",
      );
    });

    ctx.registerAction("connectWallet", async () => {
      await notify.guard(
        () => pay.connectWallet(),
        "walletConnected",
        "walletNotConnected",
      );
    });

    ctx.registerAction(
      "createVault",
      async (formData: {
        name: string;
        beneficiary: string;
        asset: string;
        total: string;
        rate: string;
        intervalDays: string;
        notes: string;
      }) => {
        await notify.guard(
          () => pay.handleCreateVault(formData),
          "vaultCreated",
          "contractMissing",
        );
      },
    );

    ctx.registerAction(
      "claimStream",
      async (stream: {
        id: string;
        creator: string;
        beneficiary: string;
        asset: string;
        assetSymbol: string;
        totalAmount: bigint;
        releasedAmount: bigint;
        remainingAmount: bigint;
        rateAmount: bigint;
        intervalSeconds: bigint;
        intervalDays: number;
        status: string;
        claimable: bigint;
        title: string;
        notes: string;
      }) => {
        await notify.guard(
          () => pay.claimStream(stream as any),
          "streamClaimed",
          "contractMissing",
        );
      },
    );

    ctx.registerAction(
      "cancelStream",
      async (stream: {
        id: string;
        creator: string;
        beneficiary: string;
        asset: string;
        assetSymbol: string;
        totalAmount: bigint;
        releasedAmount: bigint;
        remainingAmount: bigint;
        rateAmount: bigint;
        intervalSeconds: bigint;
        intervalDays: number;
        status: string;
        claimable: bigint;
        title: string;
        notes: string;
      }) => {
        await notify.guard(
          () => pay.cancelStream(stream as any),
          "streamCancelled",
          "contractMissing",
        );
      },
    );

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
    };
  },
});
