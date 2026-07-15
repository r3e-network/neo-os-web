import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { createAnchorRuntime } from "./anchor-runtime";

const APP_ID = "miniapp-profitanchor";

defineMiniApp({
  appId: APP_ID,
  playArea: PlayArea,
  manifest,
  messages,
  setup(ctx) {
    const runtime = createAnchorRuntime(ctx.framework, ctx.t, {
      appId: APP_ID,
      expectedMode: 2,
      launchNetwork: ctx.launchContext?.network,
      contracts: {
        mainnet: "0x02beeef6f65c6989a121c0a0e6b23190333edb98",
        testnet: "0xab079b4f9a0a2471d136392e25eb8e99898dcad0",
      },
    });

    ctx.framework.actions.register("connectWallet", async () => {
      const outcome = await ctx.framework.notify.guardResult(async () => {
        await runtime.connect();
      });
      return outcome.ok;
    });
    ctx.framework.actions.register("stakeNeo", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as Record<string, unknown>;
      return runtime.stake(form.amount);
    });
    ctx.framework.actions.register("withdrawNeo", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as Record<string, unknown>;
      return runtime.withdraw(form.amount);
    });
    ctx.framework.actions.register("claimRewards", runtime.claim);
    ctx.framework.actions.register("recoverNeoCredit", runtime.recover);
    ctx.framework.actions.register("refreshAnchor", runtime.loadAll);
    ctx.framework.actions.register("recoverPendingAnchor", runtime.confirmPending);

    return {
      state: runtime.state,
      loadData: runtime.loadAll,
      cleanup: runtime.cleanup,
    };
  },
});
