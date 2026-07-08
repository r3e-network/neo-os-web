import {
  createDerived,
  createObservable,
  defineMiniApp,
} from "@shared/react/defineMiniApp";
import type { Observable } from "@shared/react/context";
import { formatNum } from "@shared/utils/format";
import { TRUSTANCHOR_AGENT_ACCOUNTS } from "../../trustanchor/src/data/agentAccounts";
import { useTrustAnchor } from "../../trustanchor/src/hooks/useTrustAnchor";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./messages";

function shortAddress(value: string): string {
  if (!value) return "";
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

defineMiniApp({
  appId: "miniapp-trustanchor-admin",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const { notify } = ctx.framework;
    const anchor = useTrustAnchor({
      app: ctx.framework,
      t: ctx.t,
    });
    const agentAccounts = TRUSTANCHOR_AGENT_ACCOUNTS;

    // Per-agent NEO balances, keyed by agent account address. NEO sits in each
    // agent's own account (not in PlatformAnchor), so balance is a read-only
    // NEO.balanceOf(agentAccount) via app.wallet against the native NEO
    // contract. This turns the blind Move-NEO form into one where the operator
    // sees source balances.
    const agentBalances = createObservable<Record<string, number>>({});
    const loadAgentBalances = async () => {
      const live = anchor.agents.get();
      if (live.length === 0) return;
      try {
        const entries = await Promise.all(
          live.map(async (agent) => {
            if (!agent.account) return [agent.account, 0] as const;
            try {
              const balance = await ctx.framework.wallet.balance(
                "NEO",
                agent.account,
              );
              return [agent.account, balance] as const;
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
        const s = anchor.stats.get();
        // Only fall back to the static roster size before stats load. A real
        // on-chain count of 0 must render as 0, not be masked as 21.
        const count = s ? s.agentCount : agentAccounts.length;
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
    // True only once the on-chain agent directory has actually loaded. The
    // directory display falls back to the static roster (so balance/account
    // lookups for Move/Vote pre-validation still resolve), but the visible list
    // must not paint 21 near-identical placeholder rows before real data
    // arrives — PlayArea gates the full directory render on this flag and shows
    // a compact StateView until then.
    const agentsLive = createDerived<boolean>(
      () => anchor.agents.get().length > 0,
      [anchor.agents],
    );
    // Admin-role state: null while loading, true/false once admin() + getAppAdmin
    // resolve. Drives the read-only banner for non-operators.
    const adminState = createDerived<"loading" | "admin" | "denied">(
      () => {
        const result = anchor.isAdmin();
        if (result === null) return "loading";
        return result ? "admin" : "denied";
      },
      [anchor.adminInfo, ctx.framework.chain.address],
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
        { successKey: "anchorTransferSubmitted" },
      );
    });
    ctx.framework.actions.register("setAgentCandidate", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as Record<string, unknown>;
      await notify.guard(
        () => anchor.setAgentCandidate(form.agentId, form.candidate),
        { successKey: "candidateUpdateSubmitted" },
      );
    });
    ctx.framework.actions.register("voteAgent", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as Record<string, unknown>;
      await notify.guard(
        () => anchor.voteAgent(form.agentId),
        { successKey: "voteSyncSubmitted" },
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
        agentsLive,
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
