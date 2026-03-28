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
    const platformServices = ctx.services;

    const breakup = useBreakup({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    ctx.registerAction("createContract", () =>
      platformServices.notify.guard(
        () => breakup.createContract(),
        "contractCreated",
      ),
    );

    ctx.registerAction("signContract", (contract: unknown) =>
      platformServices.notify.guard(
        () => breakup.signContract(contract as { id: number; stake: number }),
        "contractSigned",
      ),
    );

    ctx.registerAction("breakContract", (contract: unknown) =>
      platformServices.notify.guard(
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
