/**
 * Breakup Contract — Entry Point (OS Services Pattern)
 *
 * This miniapp uses OS service proxies (ctx.os.escrow, ctx.os.storage,
 * ctx.os.badge) instead of direct chain calls. The proxies handle all
 * contract interaction through edge functions.
 *
 * Architecture:
 *   main.ts -> defineMiniApp({ playArea, manifest, setup })
 *   setup() -> useBreakup({ escrowService, storageService, ... })
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useBreakup } from "./composables/useBreakup";

defineMiniApp({
  appId: "miniapp-breakupcontract",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const breakup = useBreakup({
      escrowService: ctx.os.escrow,
      storageService: ctx.os.storage,
      badgeService: ctx.os.badge,
      eventBus: ctx.services.events,
      t: ctx.t,
    });

    ctx.registerAction("createContract", () =>
      ctx.services.notify.guard(
        () => breakup.createContract(),
        "contractCreated",
      ),
    );

    ctx.registerAction("signContract", (contract: unknown) =>
      ctx.services.notify.guard(
        () => breakup.signContract(contract as { id: number; stake: number }),
        "contractSigned",
      ),
    );

    ctx.registerAction("breakContract", (contract: unknown) =>
      ctx.services.notify.guard(
        () => breakup.breakContract(contract as { id: number }),
        "contractBroken",
      ),
    );

    return {
      state: {
        contracts: breakup.contracts,
        address: breakup.address,
        contractCount: breakup.contractCount,
        activeCount: breakup.activeCount,
        pendingCount: breakup.pendingCount,
        brokenCount: breakup.brokenCount,
        isLoading: breakup.isLoading,
      },
      loadData: breakup.loadContracts,
    };
  },
});
