/**
 * Neo Pay — React Entry Point
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useNeoPayApp } from "./composables/useNeoPayApp";

defineMiniApp({
  appId: "miniapp-neo-pay",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const pay = useNeoPayApp({
      vestingService: ctx.os.vesting,
      paymentService: ctx.os.payment,
      t: ctx.t,
    });

    ctx.registerAction("createStream", async (formData: unknown) => {
      await ctx.services.notify.guard(
        () => pay.createStream(formData as Record<string, unknown>),
        "streamCreated",
      );
    });

    ctx.registerAction("cancelStream", async (id: unknown) => {
      await ctx.services.notify.guard(
        () => pay.cancelStream(String(id)),
        "streamCancelled",
      );
    });

    ctx.registerAction("claimStream", async (id: unknown) => {
      await ctx.services.notify.guard(
        () => pay.claimStream(String(id)),
        "streamClaimed",
      );
    });

    return {
      state: {
        createdStreams: pay.createdStreams,
        beneficiaryStreams: pay.beneficiaryStreams,
        isLoading: pay.isLoading,
        isCreating: pay.isCreating,
        allStreams: pay.allStreams,
        activeCount: pay.activeCount,
        createdStreamCount: pay.createdStreamCount,
        beneficiaryStreamCount: pay.beneficiaryStreamCount,
        totalStreamCount: pay.totalStreamCount,
      },
      loadData: pay.loadAll,
    };
  },
});
