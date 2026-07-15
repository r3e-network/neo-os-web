import {
  createDerived,
  createObservable,
  defineMiniApp,
} from "@shared/react/defineMiniApp";
import type { Observable } from "@shared/react/context";
import {
  resolvePhase,
  type DataPhase,
} from "@shared/components-react/v2/DataPhase";
import { formatNum } from "@shared/utils/format";
import {
  TRUSTANCHOR_AGENT_ACCOUNTS,
  useTrustAnchor,
} from "@shared/composables/trustanchor";
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
    const agentBalances = createObservable<Record<string, number | null>>({});
    const loadAgentBalances = async () => {
      const live = anchor.agents.get();
      if (live.length === 0) return;
      try {
        const entries = await Promise.all(
          live.map(async (agent) => {
            if (!agent.account) return [agent.account, null] as const;
            try {
              const balance = await ctx.framework.wallet.balance(
                "NEO",
                agent.account,
              );
              return [agent.account, balance] as const;
            } catch {
              // A failed advisory read is unknown, not a zero balance. Keeping
              // it nullable avoids falsely blocking a valid operator route.
              return [agent.account, null] as const;
            }
          }),
        );
        const next: Record<string, number | null> = {};
        for (const [account, balance] of entries) {
          if (account) next[account] = balance;
        }
        agentBalances.set(next);
      } catch {
        // Balances are an advisory display; never block the console on them.
      }
    };
    // The anchor stat reads are contract reads that need a network the visitor
    // may not have supplied yet. That pre-data first paint is a normal state,
    // so the console publishes a phase ("loading" | "unavailable" | "ready")
    // and renders skeletons or honest zero-state copy from it — never an
    // em-dash grid. See @shared/components-react/v2/DataPhase.
    const statsPhase = createDerived<DataPhase>(
      () =>
        resolvePhase({
          loading: anchor.isLoading.get(),
          settled: anchor.loaded.get(),
          hasData: anchor.stats.get() !== null,
        }),
      [anchor.stats, anchor.isLoading, anchor.loaded],
    );
    const totalNeoDisplay = createDerived(
      () => {
        const stats = anchor.stats.get();
        return stats ? `${formatNum(stats.totalStaked)} NEO` : "";
      },
      [anchor.stats],
    );
    const reserveDisplay = createDerived(
      () => {
        const stats = anchor.stats.get();
        return stats ? `${formatNum(stats.rewardReserve)} GAS` : "";
      },
      [anchor.stats],
    );
    const selectedAgentDisplay = createDerived(
      () => {
        const stats = anchor.stats.get();
        if (!stats) return "";
        return stats.selectedAgentId ? `#${stats.selectedAgentId}` : ctx.t("noneFallback");
      },
      [anchor.stats],
    );
    const agentCountDisplay = createDerived(
      () => {
        const s = anchor.stats.get();
        const liveCount = anchor.agents.get().length;
        // Only fall back to the static roster size before stats load. A real
        // on-chain count of 0 must render as 0, not be masked as 21.
        const count = s ? s.agentCount : (liveCount || agentAccounts.length);
        return `${count} / 21`;
      },
      [anchor.stats, anchor.agents],
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
        // The configured 21-agent directory remains a degraded topology when
        // the live read is empty or unavailable. It is never treated as
        // verified chain state; `agentsLive` keeps all writes fail-closed.
        return agentAccounts.map((agent) => ({ ...agent }));
      },
      [anchor.agents, agentBalances],
    );
    // True only once a non-empty on-chain agent directory has actually loaded. The
    // directory display falls back to the static roster (so balance/account
    // lookups for Move/Vote pre-validation still resolve), but the visible list
    // must not paint 21 near-identical placeholder rows before real data
    // arrives — PlayArea gates the full directory render on this flag and shows
    // degraded 21-node topology remains visible, but writes stay locked.
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
        statsPhase: statsPhase as Observable,
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
