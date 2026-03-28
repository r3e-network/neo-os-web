/**
 * TrustAnchor — Entry Point (New Pattern)
 */

import { computed } from "vue";
import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { formatNumber } from "@shared/utils/format";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useTrustAnchor } from "./composables/useTrustAnchor";
import { TRUSTANCHOR_AGENT_ACCOUNTS } from "./pages/index/data/agentAccounts";

defineMiniApp({
  appId: "miniapp-trustanchor",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = ctx.services;

    const { notify } = platformServices;

    const formatNum = (n: number | string) => formatNumber(n, 2);

    const anchor = useTrustAnchor({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    const agentAccounts = TRUSTANCHOR_AGENT_ACCOUNTS;

    const myStakeDisplay = computed(
      () => `${formatNum(anchor.myStake.value)} ${ctx.t("tokenNeo")}`,
    );
    const pendingRewardsDisplay = computed(
      () => `${formatNum(anchor.pendingRewards.value)} ${ctx.t("tokenGas")}`,
    );
    const agentCount = computed(() => agentAccounts.length);
    const ingressCount = computed(() => 21);

    ctx.registerAction("stake", async (...args: unknown[]) => {
      const amount = args[0] as number;
      if (!amount || amount <= 0) return;
      await notify.guard(() => anchor.stake(amount), "stakeSuccess");
    });

    ctx.registerAction("unstake", async (...args: unknown[]) => {
      const amount = args[0] as number;
      if (!amount || amount <= 0) return;
      await notify.guard(() => anchor.unstake(amount), "unstakeSuccess");
    });

    ctx.registerAction("claimRewards", async () => {
      await notify.guard(() => anchor.claimRewards(), "claimSuccess");
    });

    ctx.registerAction("claimPendingWithdraw", async () => {
      await notify.guard(
        () => anchor.claimPendingWithdraw(),
        "withdrawSuccess",
      );
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
    };
  },
});
