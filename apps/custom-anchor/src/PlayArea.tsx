import type { PlayAreaProps } from "@shared/react/defineMiniApp";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import "./PlayArea.scss";

function truncate(value: string): string {
  if (value.length <= 34) return value;
  return `${value.slice(0, 18)}...${value.slice(-10)}`;
}

export default function PlayArea({ t, state, status }: PlayAreaProps) {
  const { str, num, bool } = useStateBindings(state);
  const anchorAppId = str("anchorAppId");
  const isLoading = bool("isLoading");
  const agentCount = num("agentCount");
  const lastTxid = str("lastTxid");
  const anchorStatus = anchorAppId ? t("anchorLinked") : t("anchorMissing");
  const displayedAnchor = anchorAppId ? truncate(anchorAppId) : t("anchorAwaitingLaunch");
  const displayedTx = lastTxid ? truncate(lastTxid) : t("notAvailable");

  return (
    <div className="custom-anchor-playarea">
      <section className="custom-anchor-hero">
        <div>
          <span className="custom-anchor-kicker">{t("title")}</span>
          <h2>{anchorAppId ? t("readyForAnchor") : t("noAnchorTitle")}</h2>
          <p>{anchorAppId ? truncate(anchorAppId) : t("noAnchorBody")}</p>
        </div>
        <div className="custom-anchor-orbit" aria-hidden="true">
          <span>21</span>
          <small>AA</small>
        </div>
      </section>

      <div className="custom-anchor-metrics" aria-live="polite">
        <div>
          <span>{t("userStake")}</span>
          <strong>{str("userStake")} NEO</strong>
        </div>
        <div>
          <span>{t("pendingRewards")}</span>
          <strong>{str("pendingRewards")} GAS</strong>
        </div>
        <div>
          <span>{t("rewardReserve")}</span>
          <strong>{str("rewardReserve")} GAS</strong>
        </div>
      </div>

      <section className="custom-anchor-workspace" aria-label={t("anchorWorkspaceTitle")}>
        <div className="custom-anchor-status-card">
          <div className="custom-anchor-section-head">
            <span>{t("anchorWorkspaceLabel")}</span>
            <h3>{t("anchorWorkspaceTitle")}</h3>
            <p>{t("anchorWorkspaceBody")}</p>
          </div>

          <div className="custom-anchor-flow" aria-label={t("anchorFlowTitle")}>
            <div>
              <span className="custom-anchor-flow__number">01</span>
              <strong>{t("anchorFlowOpen")}</strong>
            </div>
            <div>
              <span className="custom-anchor-flow__number">02</span>
              <strong>{t("anchorFlowAction")}</strong>
            </div>
            <div>
              <span className="custom-anchor-flow__number">03</span>
              <strong>{t("anchorFlowSign")}</strong>
            </div>
          </div>

          <div className="custom-anchor-guidance-grid">
            <div>
              <span>{t("userRoute")}</span>
              <strong>{t("userRouteBody")}</strong>
            </div>
            <div>
              <span>{t("adminRoute")}</span>
              <strong>{t("adminRouteBody")}</strong>
            </div>
            <div>
              <span>{t("safetyRail")}</span>
              <strong>{t("safetyRailBody")}</strong>
            </div>
          </div>
        </div>

        <aside className="custom-anchor-id-card" aria-label={t("anchorStatus")}>
          <span>{t("launchSource")}</span>
          <strong>{displayedAnchor}</strong>
          <dl>
            <div>
              <dt>{t("anchorStatus")}</dt>
              <dd>{anchorStatus}</dd>
            </div>
            <div>
              <dt>{t("agentCount")}</dt>
              <dd>{agentCount || 21}</dd>
            </div>
            <div>
              <dt>{t("lastTxid")}</dt>
              <dd>{displayedTx}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <details className="custom-anchor-model" open>
        <summary>{t("routingDetails")}</summary>
        <div className="custom-anchor-model__body">
          <p>{t("agentModelBody")}</p>
        </div>
        <dl>
          <div>
            <dt>{t("totalStaked")}</dt>
            <dd>{str("totalStaked")} NEO</dd>
          </div>
          <div>
            <dt>{t("agentCount")}</dt>
            <dd>{agentCount || 21}</dd>
          </div>
        </dl>
      </details>

      {(isLoading || status?.msg) && (
        <div className="custom-anchor-footnote">
          {isLoading && <span>Loading on-chain anchor state...</span>}
          {status?.msg && <span>{status.msg}</span>}
        </div>
      )}
    </div>
  );
}
