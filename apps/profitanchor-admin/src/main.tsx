import {
  createDerived,
  createObservable,
  defineMiniApp,
} from "@shared/react/defineMiniApp";
import type { Observable } from "@shared/react/context";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import { formatNum } from "@shared/utils/format";
import { PROFITANCHOR_AGENT_ACCOUNTS } from "../../profitanchor/src/data/agentAccounts";
import { useProfitAnchor } from "../../profitanchor/src/hooks/useProfitAnchor";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./messages";

function shortAddress(value: string): string {
  if (!value) return "";
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

/** Coerce a NEP-17 balanceOf stack item (number/bigint/string/{value}) to a number. */
function balanceToNumber(input: unknown): number {
  if (typeof input === "number") return input;
  if (typeof input === "bigint") return Number(input);
  if (typeof input === "string") return Number(input) || 0;
  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    return balanceToNumber(record.value ?? record.integer ?? record.result);
  }
  return 0;
}

defineMiniApp({
  appId: "miniapp-profitanchor-admin",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const { notify } = ctx.services;
    const anchor = useProfitAnchor({
      app: ctx.framework,
      eventBus: ctx.services.events,
      t: ctx.t,
    });
    const agentAccounts = PROFITANCHOR_AGENT_ACCOUNTS;

    // Per-agent NEO balances, keyed by agent account address. NEO sits in each
    // agent's own account (not in PlatformAnchor), so balance is a read-only
    // NEO.balanceOf(agentAccount) against the native NEO contract. This turns the
    // blind Move-NEO form into one where the operator sees source balances.
    const agentBalances = createObservable<Record<string, number>>({});
    const loadAgentBalances = async () => {
      const live = anchor.agents.get();
      if (live.length === 0) return;
      try {
        const entries = await Promise.all(
          live.map(async (agent) => {
            if (!agent.account) return [agent.account, 0] as const;
            try {
              const raw = await ctx.services.chain.read(
                "balanceOf",
                [{ type: "Hash160", value: agent.account }],
                { scriptHash: BLOCKCHAIN_CONSTANTS.NEO_HASH },
              );
              return [agent.account, balanceToNumber(raw)] as const;
            } catch {
              return [agent.account, 0] as const;
            }
          }),
        );
        const next: Record<string, number> = {};
        for (const [account, balance] of entries) {
          if (account) next[account] = balance;
        }
        agentBalances.set(next);
      } catch {
        // Balances are an advisory display; never block the console on them.
      }
    };
    const totalNeoDisplay = createDerived(
      () => `${formatNum(anchor.stats.get()?.totalStaked ?? 0)} NEO`,
      [anchor.stats],
    );
    const reserveDisplay = createDerived(
      () => `${formatNum(anchor.stats.get()?.rewardReserve ?? 0)} GAS`,
      [anchor.stats],
    );
    const selectedAgentDisplay = createDerived(
      () =>
        anchor.stats.get()?.selectedAgentId
          ? `#${anchor.stats.get()?.selectedAgentId}`
          : ctx.t("noneFallback"),
      [anchor.stats],
    );
    const agentCountDisplay = createDerived(
      () => {
        const onChainCount = anchor.stats.get()?.agentCount;
        // Only fall back to the static roster size before stats load
        // (undefined). A real on-chain count of 0 must render as 0, not be
        // masked by the 21-entry static array via a falsy-OR.
        const count = Number.isFinite(onChainCount)
          ? (onChainCount as number)
          : agentAccounts.length;
        return `${count} / 21`;
      },
      [anchor.stats],
    );
    // On-chain agent directory (ground truth) with the static roster as a
    // pre-load fallback so the directory is never empty on first paint. Live
    // rows carry the on-chain account/candidate/active flag plus the read NEO
    // balance so the operator sees source balances before a Move.
    const agentDirectory = createDerived<Array<Record<string, unknown>>>(
      () => {
        const live = anchor.agents.get();
        if (live.length > 0) {
          const balances = agentBalances.get();
          return live.map((agent) => ({
            ...agent,
            neoBalance: agent.account ? (balances[agent.account] ?? null) : null,
          }));
        }
        return agentAccounts.map((agent) => ({ ...agent }));
      },
      [anchor.agents, agentBalances],
    );
    // Admin-role state: null while loading, true/false once admin() + getAppAdmin
    // resolve. Drives the read-only banner for non-operators.
    const adminState = createDerived<"loading" | "admin" | "denied">(
      () => {
        const result = anchor.isAdmin();
        if (result === null) return "loading";
        return result ? "admin" : "denied";
      },
      [anchor.adminInfo, ctx.services.chain.address],
    );
    const expectedAdminDisplay = createDerived(
      () => {
        const info = anchor.adminInfo.get();
        if (!info) return "";
        return shortAddress(info.appAdmin || info.platformAdmin);
      },
      [anchor.adminInfo],
    );

    ctx.framework.actions.register("transferAgentNeo", async (...args: unknown[]) => {
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
    ctx.framework.actions.register("setAgentCandidate", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as Record<string, unknown>;
      await notify.guard(
        () => anchor.setAgentCandidate(form.agentId, form.candidate),
        "candidateUpdateSubmitted",
      );
    });
    ctx.framework.actions.register("voteAgent", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as Record<string, unknown>;
      await notify.guard(
        () => anchor.voteAgent(form.agentId),
        "voteSyncSubmitted",
      );
    });

    return {
      state: {
        stats: anchor.stats,
        agentAccounts: agentDirectory as Observable,
        totalNeoDisplay,
        reserveDisplay,
        selectedAgentDisplay,
        agentCountDisplay,
        adminState,
        expectedAdminDisplay,
      } satisfies Record<string, Observable>,
      loadData: async () => {
        await anchor.loadAll();
        await loadAgentBalances();
      },
    };
  },
});
