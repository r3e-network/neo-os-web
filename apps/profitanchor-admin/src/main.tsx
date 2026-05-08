import {
  createDerived,
  createObservable,
  defineMiniApp,
} from "@shared/react/defineMiniApp";
import type { Observable } from "@shared/react/context";
import { formatNumber } from "@shared/utils/format";
import { PROFITANCHOR_AGENT_ACCOUNTS } from "../../profitanchor/src/pages/index/data/agentAccounts";
import { useProfitAnchor } from "../../profitanchor/src/hooks/useProfitAnchor";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./messages";

defineMiniApp({
  appId: "miniapp-profitanchor-admin",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const { notify } = ctx.services;
    const anchor = useProfitAnchor({
      chain: ctx.services.chain,
      eventBus: ctx.services.events,
      t: ctx.t,
    });
    const agentAccounts = PROFITANCHOR_AGENT_ACCOUNTS;
    const formatNum = (n: number | string) => formatNumber(n, 2);
    const totalNeoDisplay = createDerived(
      () => `${formatNum(anchor.stats.get()?.totalStaked ?? 0)} NEO`,
      [anchor.stats],
    );
    const selectedAgentDisplay = createDerived(
      () =>
        anchor.stats.get()?.selectedAgentId
          ? `#${anchor.stats.get()?.selectedAgentId}`
          : "None",
      [anchor.stats],
    );
    const agentCountDisplay = createDerived(
      () => `${anchor.stats.get()?.agentCount || agentAccounts.length} / 21`,
      [anchor.stats],
    );

    ctx.registerAction("transferAgentNeo", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as Record<string, unknown>;
      await notify.guard(
        () =>
          anchor.transferAgentNeo(
            form.fromAgentId,
            form.toAgentId,
            form.amount,
          ),
        "anchorTransferSubmitted",
      );
    });
    ctx.registerAction("setAgentCandidate", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as Record<string, unknown>;
      await notify.guard(
        () => anchor.setAgentCandidate(form.agentId, form.candidate),
        "candidateUpdateSubmitted",
      );
    });
    ctx.registerAction("voteAgent", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as Record<string, unknown>;
      await notify.guard(
        () => anchor.voteAgent(form.agentId),
        "voteSyncSubmitted",
      );
    });

    return {
      state: {
        stats: anchor.stats,
        agentAccounts: createObservable(agentAccounts),
        totalNeoDisplay,
        selectedAgentDisplay,
        agentCountDisplay,
      } satisfies Record<string, Observable>,
      loadData: anchor.loadAll,
    };
  },
});
