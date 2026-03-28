/**
 * TrustAnchor — Entry Point (New Pattern)
 */

import { ref, computed } from "vue";
import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import { formatNumber } from "@shared/utils/format";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useTrustAnchor } from "./pages/index/composables/useTrustAnchor";
import { TRUSTANCHOR_AGENT_ACCOUNTS } from "./pages/index/data/agentAccounts";

defineMiniApp({
  appId: "miniapp-trustanchor",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-trustanchor", {
      t: ctx.t as (key: string) => string,
    });

    const formatNum = (n: number | string) => formatNumber(n, 2);

    const anchor = useTrustAnchor(ctx.t as (key: string) => string);
    const agentAccounts = TRUSTANCHOR_AGENT_ACCOUNTS;

    const myStakeDisplay = computed(() => `${formatNum(anchor.myStake.value)} ${ctx.t("tokenNeo")}`);
    const pendingRewardsDisplay = computed(() => `${formatNum(anchor.pendingRewards.value)} ${ctx.t("tokenGas")}`);
    const agentCount = computed(() => agentAccounts.length);
    const ingressCount = computed(() => 21);

    ctx.registerAction("stake", async (...args: unknown[]) => {
      const amount = args[0] as number;
      if (!amount || amount <= 0) return;
      try {
        await anchor.stake(amount);
        ctx.setStatus(ctx.t("stakeSuccess") || "Staked successfully", "success");
      } catch (e: unknown) {
        ctx.setStatus(e instanceof Error ? e.message : String(e), "error");
      }
    });

    ctx.registerAction("unstake", async (...args: unknown[]) => {
      const amount = args[0] as number;
      if (!amount || amount <= 0) return;
      try {
        await anchor.unstake(amount);
        ctx.setStatus(ctx.t("unstakeSuccess") || "Unstaked successfully", "success");
      } catch (e: unknown) {
        ctx.setStatus(e instanceof Error ? e.message : String(e), "error");
      }
    });

    ctx.registerAction("claimRewards", async () => {
      try {
        await anchor.claimRewards();
        ctx.setStatus(ctx.t("claimSuccess") || "Rewards claimed", "success");
      } catch (e: unknown) {
        ctx.setStatus(e instanceof Error ? e.message : String(e), "error");
      }
    });

    ctx.registerAction("claimPendingWithdraw", async () => {
      try {
        await anchor.claimPendingWithdraw();
        ctx.setStatus(ctx.t("withdrawSuccess") || "Withdrawal claimed", "success");
      } catch (e: unknown) {
        ctx.setStatus(e instanceof Error ? e.message : String(e), "error");
      }
    });

    return {
      state: {
        stats: anchor.stats,
        myStake: anchor.myStake,
        pendingRewards: anchor.pendingRewards,
        pendingWithdraw: anchor.pendingWithdraw,
        agentAccounts: computed(() => agentAccounts),
        myStakeDisplay,
        pendingRewardsDisplay,
        agentCount,
        ingressCount,
      },

      loadData: anchor.loadAll,

      cleanup: () => {
        platformServices.destroy();
      },
    };
  },
});
