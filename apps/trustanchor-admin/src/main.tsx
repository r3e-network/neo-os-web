import {
  createDerived,
  defineMiniApp,
} from "@shared/react/defineMiniApp";
import type { Observable } from "@shared/react/context";
import { formatNumber } from "@shared/utils/format";
import { TRUSTANCHOR_AGENT_ACCOUNTS } from "../../trustanchor/src/pages/index/data/agentAccounts";
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
    const { notify } = ctx.services;
    const anchor = useTrustAnchor({
      chain: ctx.services.chain,
      eventBus: ctx.services.events,
      t: ctx.t,
    });
    const agentAccounts = TRUSTANCHOR_AGENT_ACCOUNTS;
    const formatNum = (n: number | string) => formatNumber(n, 2);
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
    // pre-load fallback so the directory is never empty on first paint.
    const agentDirectory = createDerived<Array<Record<string, unknown>>>(
      () => {
        const live = anchor.agents.get();
        if (live.length > 0) {
          return live.map((agent) => ({ ...agent }));
        }
        return agentAccounts.map((agent) => ({ ...agent }));
      },
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
        agentAccounts: agentDirectory as Observable,
        totalNeoDisplay,
        reserveDisplay,
        selectedAgentDisplay,
        agentCountDisplay,
        adminState,
        expectedAdminDisplay,
      } satisfies Record<string, Observable>,
      loadData: anchor.loadAll,
    };
  },
});
