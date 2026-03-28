import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
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
    const platformServices = PlatformServices.create("miniapp-breakupcontract", {
      t: ctx.t as (key: string) => string,
    });

    const breakup = useBreakup({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    ctx.registerAction("createContract", async () => {
      try { await breakup.createContract(); ctx.setStatus(ctx.t("contractCreated"), "success"); }
      catch (e) { ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error"); }
    });

    ctx.registerAction("signContract", async (contract: unknown) => {
      try { await breakup.signContract(contract as { id: number; stake: number }); ctx.setStatus(ctx.t("contractSigned"), "success"); }
      catch (e) { ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error"); }
    });

    ctx.registerAction("breakContract", async (contract: unknown) => {
      try { await breakup.breakContract(contract as { id: number }); ctx.setStatus(ctx.t("contractBroken"), "success"); }
      catch (e) { ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error"); }
    });

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
      cleanup: () => { platformServices.destroy(); },
    };
  },
});
