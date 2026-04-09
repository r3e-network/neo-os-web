/**
 * PlayArea.tsx -- TrustAnchor
 *
 * React version of the TrustAnchor play area with hero gauge,
 * stats overview, routing summary, and stake/unstake/claim operations.
 */

import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { TrustAnchorStats } from "./hooks/useTrustAnchor";
import AnchorGaugeHero from "./components/AnchorGaugeHero";
import StakeOperationPanel from "./components/StakeOperationPanel";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { val } = useStateBindings(state);

  const stats = val<TrustAnchorStats | null>("stats", null);
  const pendingRewards = val<number>("pendingRewards", 0);
  const pendingWithdraw = val<number>("pendingWithdraw", 0);
  const agentAccounts = val<Array<Record<string, unknown>>>("agentAccounts", []);

  return (
    <div className="trustanchor-play-area">
      <AnchorGaugeHero
        t={t}
        totalStaked={stats?.totalStaked ?? 0}
        agentCount={agentAccounts.length}
      />

      <div className="neo-card mb-4 px-1">
        <div className="section-header mb-4">
          <span className="section-title">{t("routingSummaryTitle")}</span>
        </div>
        <span className="section-desc">{t("routingSummaryDesc")}</span>
      </div>

      <div className="neo-card px-1">
        <div className="section-header mb-4">
          <span className="section-title">{t("rebalanceTitle")}</span>
        </div>
        <span className="section-desc">{t("rebalanceDesc")}</span>
      </div>

      <StakeOperationPanel
        t={t}
        pendingRewards={pendingRewards}
        pendingWithdraw={pendingWithdraw}
        dispatch={dispatch}
      />
    </div>
  );
}
